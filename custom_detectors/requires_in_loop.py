from typing import List, Optional
from slither.core.cfg.node import NodeType, Node
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.declarations import Contract, Function
from slither.core.solidity_types.array_type import ArrayType
from slither.slithir.operations import SolidityCall, InternalCall, HighLevelCall
from slither.utils.output import Output

class Context():
    def __init__(self, func_array_params, in_loop_counter, visited: List[Node], derivedPLengths, 
        flag_array_length, flag_require_in_loop, flag_state_written_outside_loop, flag_ecrecover_in_loop):
      self.func_array_params = func_array_params
      self.in_loop_counter = in_loop_counter
      self.visited = visited
      self.derivedPLengths = derivedPLengths
      self.flag_array_length = flag_array_length
      self.flag_require_in_loop = flag_require_in_loop
      self.flag_state_written_outside_loop = flag_state_written_outside_loop
      self.flag_ecrecover_in_loop = flag_ecrecover_in_loop

    def __str__(self): # debug
      return ('func_array_params' + str(self.func_array_params) + 
        ' - in_loop_counter' + str(self.in_loop_counter) + 
        ' - derivedPLengths' + str(self.derivedPLengths) + 
        ' - flag_array_length' + str(self.flag_array_length) + 
        ' - flag_require_in_loop' + str(self.flag_require_in_loop))

          
# ok - function param array VAR
# ok - for loop till VAR.length or derivedLength
# ok - for loop contains require or revert
# ok - function does not contain a require or if on VAR.length or derivedLength, before the for loop
# ok - state vars written by an outside node
# ok - flag ecrecover

# widespread false positives
banned_funcs = ["constructor", "initialize", "multicall", "executeMulticall"]
# partial (LIKE %x%)
banned_funcs_partial = [] 
  

def check_contract(c: Contract) -> List[Function]:
  results_raw: List[Function] = []

  # skip test contracts
  if any( x in c.name for x in ["Test", "Mock"]): 
    return results_raw

  # to filter constructors for old solidity versions
  inherited_contracts = get_inherited_contracts(c) + [c.name] 

  # filter unwanted funcs (also checked later recursively for nested calls)
  to_inspect = (x for x in c.functions if (
    # filter banned functions and old solc constructors
    x.name not in (banned_funcs + inherited_contracts) and 
    not any( x.name in y for y in banned_funcs_partial) and
    is_public_or_external(x) and 
    x.is_implemented and 
    not is_modifier_protected(x)))

  for f in to_inspect: 
    # filter array params
    array_params = []
    for par in f.parameters:
      if isinstance(par.type, ArrayType):
        array_params.append(par.name)
    if len(array_params) > 0: # skip function if no array param
      # check the function
      if check_function(f.entry_point, Context(array_params, 0, [], [], False, False, False, False)): 
        results_raw.append(f)
  return results_raw


def check_function(node: Optional[Node], ctx: Context):
  if node is None:
    return False

  if node in ctx.visited:
    return False
  ctx.visited.append(node)

  if node.type == NodeType.STARTLOOP: # note: nested loops are not handled
    ctx.in_loop_counter += 1

  elif node.type == NodeType.ENDLOOP:
    ctx.in_loop_counter -= 1
    if ctx.in_loop_counter == 0:
      # initial loop closed, lets wrap up results and build the score
      if ctx.flag_array_length and ctx.flag_require_in_loop and ctx.flag_state_written_outside_loop and ctx.flag_ecrecover_in_loop:
        return True

  # debug
  # print(str(node) + "  " + str(len(node.sons)) + "  " + str(node.type)) 
  # print(str(ctx) + "\n")
  
  elif ctx.in_loop_counter == 0: # outside the for loop
    # check if a state var is written
    if not ctx.flag_state_written_outside_loop:
      if node_writes_state_vars(node):
        ctx.flag_state_written_outside_loop = True

    # track declaration of new vars derived from param.length - builds ctx.derivedPLengths
    if node.type == NodeType.VARIABLE:
      sides = str(node).split(" = ") # no need to cut since '.length' boosts precision
      if(len(sides) == 2):
        if any ((x + ".length") in sides[1] for x in ctx.func_array_params):
          # extract left side var name and push to ctx.derivedPLengths
          derived_var_name = sides[0].split(" ")[-1] 
          ctx.derivedPLengths.append(derived_var_name)

    # track require before loop 
    # removes from ctx.derivedPLengths and func_array_params the vars whose length is checked by a require statement
    elif is_require_node(node):
      ctx = purge_param_if_checked(str(node)[len("EXPRESSION "):], ctx)
      
    # track if-revert before loop
    # removes from ctx.derivedPLengths and func_array_params the vars whose length is checked by an if-revert
    elif node.type == NodeType.IF:
      if if_loop_contains_revert(node):
        ctx = purge_param_if_checked(str(node)[len("IF "):], ctx)
      
  else: # inside the for loop 
    # check if the loop condition uses a param.length or a derived length variable, set flag_array_length if so
    if node.type == NodeType.IFLOOP:
      nodeStr = str(node)[len("IF_LOOP "):]
      paramsLengths = list(map((lambda x: x + ".length"), ctx.func_array_params))
      if any(x in nodeStr for x in (paramsLengths + ctx.derivedPLengths)):
        ctx.flag_array_length = True
    
    # check if the loop contains a require, set flag_require_in_loop if so
    elif is_require_node(node) or (node.type == NodeType.IF and if_loop_contains_revert(node)):
      ctx.flag_require_in_loop = True
    
    # check if the loop contains a require, set flag_require_in_loop if so
    elif node_contains_ecrecover(node):
      ctx.flag_ecrecover_in_loop = True



  # if not, keep inspecting children nodes
  ret = False
  for son in node.sons:
      ret = ret or check_function(son, ctx)
  return ret


# node_str is the node of a require or if-revert condition.
# if a param's length is checked here (outside the loop), the param gets purged
def purge_param_if_checked(node_str, ctx) -> Context:
  for ap in ctx.func_array_params[:]:
    if (ap + ".length") in node_str:
      ctx.func_array_params.remove(ap)
  for dpl in ctx.derivedPLengths[:]:
    if dpl in node_str:
      ctx.derivedPLengths.remove(dpl)
  return ctx
  

# checks if a node is a require statement
def is_require_node(node: Node) -> bool:
  for ir in node.irs:
    if isinstance(ir, SolidityCall) and ir.function.name in ["require(bool,string)", "require(bool)"]:
      return True
  return False


def func_writes_state_vars(func: Function, visited: List[Node]):
  ret = False
  for node in func.nodes:
    ret = ret or node_writes_state_vars(node, visited)
  return ret


# recursively check if a node writes storage
def node_writes_state_vars(node: Node, visited: List[Node] = []):
  # avoid edge case recursion loop
  if node in visited: 
    return False
  visited.append(node)

  if len(node.state_variables_written) > 0:
    return True

  # check if node contains internal calls, recursive check if so
  ret = False
  for ir in node.irs:
    if(isinstance(ir, InternalCall)): # internal call IR
      ret = ret or func_writes_state_vars(ir.function, visited)
      
  return ret


def func_contains_ecrecover(func: Function, visited: List[Node]):
  ret = False
  for node in func.nodes:
    ret = ret or node_contains_ecrecover(node, visited)
  return ret


# recursively check if a node contains ecrecover
def node_contains_ecrecover(node: Node, visited: List[Node] = []):
  # avoid edge case recursion loop
  if node in visited: 
    return False
  visited.append(node)

  # check if node contains internal calls, recursive check if so
  ret = False
  for ir in node.irs:
    if(isinstance(ir, SolidityCall)):
      fname = ir.function.name
      if fname == "ecrecover(bytes32,uint8,bytes32,bytes32)":
        return True
    if(isinstance(ir, InternalCall)): # internal call IR
      ret = ret or func_contains_ecrecover(ir.function, visited)
      
  return ret


def is_modifier_protected(func: Function) -> bool:
    bannedPattern = ['admin', 'owner', 'role', 'permission', 'initializ', 'auth']
    for mod in func.modifiers:
        for ban in bannedPattern:
            if ban in str(mod).lower():
                return True
    return False


# checks if an if body contains a revert statement. 
# Used to find the pattern if(param.length==0) revert, but also finds revert in internal calls
def if_loop_contains_revert(node: Node, in_if_count = 1, visited: List[Node] = []):
  if node in visited:
    return False
  visited.append(node)

  if node.type == NodeType.EXPRESSION:
    if "revert" in str(node)[len("EXPRESSION "):]:
      return True

  if node.type == NodeType.ENDIF:
    in_if_count -= 1
    if in_if_count == 0: # original loop closed
      return False

  if node.type == NodeType.IF: # nested if
    in_if_count += 1

  ret = False
  for son in node.sons:  # if too many false positives, cut internal calls
    ret = ret or if_loop_contains_revert(son, in_if_count, visited)
  return ret


def get_inherited_contracts(contract: Contract) -> List[str]:
    return list(x.name for x in contract.inheritance)

def is_public_or_external(func: Function) -> bool:
    return func.visibility in ["public", "external"]

class RequiresInLoop(AbstractDetector):

    ARGUMENT = "requires-in-loop"
    HELP = "Detects input array validation in loop where length=0 is not checked"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.LOW

    WIKI = "-"

    WIKI_TITLE = "Requires in loop"
    WIKI_DESCRIPTION = "https://twitter.com/akshaysrivastv/status/1648310441058115592"

    # region wiki_exploit_scenario
    WIKI_EXPLOIT_SCENARIO = "www"

    WIKI_RECOMMENDATION = "-"

    def _detect(self) -> List[Output]:
      """"""
      results_raw: List[Function] = []
      results: List[Output] = []
      for c in self.compilation_unit.contracts_derived:
        results_raw += check_contract(c)

      for f in results_raw:
        info = [
          f"Found unvalidated length loop in function ",
          f,
          "\n"
        ]
        res = self.generate_result(info)
        results.append(res)

      return results         

