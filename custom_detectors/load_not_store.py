from typing import List, Optional
from slither.core.cfg.node import NodeType, Node
from slither.core.declarations import Contract, Function
from slither.core.variables import StateVariable
from slither.core.variables.local_variable import LocalVariable
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.slithir.operations import SolidityCall, InternalCall, HighLevelCall, Assignment, Return
from slither.utils.output import Output

class StorageLoad():
    def __init__(self, storage_var: StateVariable, derived_vars = [], verbose = False):
      self.storage_var = storage_var
      self.derived_vars = derived_vars
      self.verbose = verbose

    def addDerived(self, memory_var):
      self.derived_vars.append(memory_var)

    def __str__(self): # debug
        return 'SV:' + str(self.storage_var) + " - DV: " + str(list(map((lambda x: x.name), self.derived_vars)))

class Context():
    def __init__(self, header_returns, visited: List[Node] = [], vars_state_load: List[StorageLoad] = []):
      self.header_returns = header_returns
      self.visited = visited
      self.vars_state_load = vars_state_load

    def __str__(self): # debug
        return 'visited' + str(self.visited)

# widespread false positives
banned_funcs = []
# partial (LIKE %x%)
banned_funcs_partial = [] 
  

def check_contract(c: Contract) -> List[StorageLoad]:
  results_raw: List[StorageLoad] = []

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
    x.is_implemented))

  for f in to_inspect: 
    hits = check_function(f.entry_point, Context(f.returns, [], []))
    if len(hits):
      results_raw += hits
  return results_raw


def check_function(node: Optional[Node], ctx: Context)-> List[StorageLoad]:
  if node is None:
    return []

  if node in ctx.visited:
    return []
  ctx.visited.append(node)

  
  # check load from storage
  if node.type in [NodeType.VARIABLE, NodeType.EXPRESSION]:
    local_stored = node.local_variables_written
    state_stored = node.state_variables_written
    local_read = node.local_variables_read
    state_read = node.state_variables_read

    for lv in local_stored:
      # add new storage read, even if not direct
      for sv in state_read:
        ctx.vars_state_load.append(StorageLoad(sv, [lv]))
      # add new reference to loaded var 
      for lvr in local_read:
        if lv == lvr:
          continue 
        for vsl in ctx.vars_state_load[:]:
          if lvr in vsl.derived_vars:
            vsl.addDerived(lv)
    # check if mem vars get stored back
    for sv in state_stored:
      for vsl in ctx.vars_state_load[:]:
        if vsl.storage_var == sv: 
          ctx.vars_state_load.remove(vsl)
    # remove derived used (read)
    for lv in local_read:
      ctx = remove_if_loaded(ctx, lv)

  # check function calls parameters, or highlevelcall destination
  for ir in node.irs:
    if isinstance(ir, InternalCall) or isinstance(ir, HighLevelCall):
      if isinstance(ir, HighLevelCall):
        if isinstance(ir.destination, LocalVariable):
          # remove loaded
          ctx = remove_if_loaded(ctx, ir.destination)
        else: # destination is derived, use local_read to get it and purge
          local_read = node.local_variables_read
          for lv in local_read:
            ctx = remove_if_loaded(ctx, lv)
      # get params, remove from vars_state_load
      call_args = ir.arguments
      for arg in call_args:
        ctx = remove_if_loaded(ctx, arg)

  # check if a derived var is used in an if or require statement or sstore
  if node.type in [NodeType.IF, NodeType.IFLOOP, NodeType.RETURN] or is_solidity_call(node):
    local_read = node.local_variables_read
    # remove derived if any
    for lvr in local_read:
      ctx = remove_if_loaded(ctx, lvr)

  if not len(node.sons):
    # clean results from header returns
    for hr in ctx.header_returns:
      ctx = remove_if_loaded(ctx, hr)
    return ctx.vars_state_load

  # keep the vars not solved in any of the sons
  intersection = None
  for son in node.sons:
    son_vars = check_function(son, ctx)
    if not intersection:
      intersection = son_vars
    else:
      # remove the ones not present in sons
      for vsl in intersection[:]:
        if not has_same_storage_in_list(vsl, son_vars):
          intersection.remove(vsl)
  ctx.vars_state_load = intersection # vars not solved in any son
  return ctx.vars_state_load

def has_same_storage_in_list(vsl, list) -> bool:
  found = False
  for v in list:
    if v.storage_var == vsl.storage_var:
      found = True
      break
  return found

def remove_if_loaded(ctx: Context, memory_var):
  for vsl in ctx.vars_state_load[:]:
    if memory_var in vsl.derived_vars:
      ctx.vars_state_load.remove(vsl)
  return ctx

# checks if a node is a require statement
def is_solidity_call(node: Node) -> bool:
  for ir in node.irs:
    if isinstance(ir, SolidityCall):
      return True
  return False


def get_inherited_contracts(contract: Contract) -> List[str]:
    return list(x.name for x in contract.inheritance)

class LoadNotStore(AbstractDetector):

    ARGUMENT = "load-not-store"
    HELP = "-"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.LOW

    WIKI = "-"

    WIKI_TITLE = "-"
    WIKI_DESCRIPTION = "-"

    # region wiki_exploit_scenario
    WIKI_EXPLOIT_SCENARIO = "www"

    WIKI_RECOMMENDATION = "-"

    def _detect(self) -> List[Output]:
      """"""
      results_raw: List[StorageLoad] = []
      results: List[Output] = []
      for c in self.compilation_unit.contracts_derived:
        results_raw += check_contract(c)

      for sl in results_raw:
        info = [
          f"Found unused memory vars '",
          *sl.derived_vars,
          "' loaded from storage var '",
          sl.storage_var,
          "'\n"
        ]
        res = self.generate_result(info)
        results.append(res)

      return results         

