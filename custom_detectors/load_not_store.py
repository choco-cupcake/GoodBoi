from typing import List, Optional
from slither.core.cfg.node import NodeType, Node
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.declarations import Contract, Function
from slither.core.variables import StateVariable
from slither.core.variables.local_variable import LocalVariable
from slither.core.solidity_types.array_type import ArrayType
from slither.slithir.operations import SolidityCall, InternalCall, HighLevelCall, Assignment
from slither.utils.output import Output
from slither.slithir.variables import TupleVariable

class StorageLoad():
    def __init__(self, memory_var: LocalVariable, storage_var: StateVariable):
        self.memory_var = memory_var
        self.storage_var = storage_var


class Context():
    def __init__(self, visited: List[Node] = [], vars_state_load: List[StorageLoad] = []):
        self.visited = visited
        self.vars_state_load = vars_state_load

    def __str__(self): # debug
        return 'visited' + str(self.visited)


# == load from storage
# node NEW VARIABLE
# single ir
# check that type in ir is not a std one
# fetch right side of node str
# check if its a state var (get contracts state var)
# == write to storage

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
    hits = check_function(f.entry_point, Context())
    if len(hits):
      results_raw += hits
  return results_raw


def check_function(node: Optional[Node], ctx: Context)-> List[StorageLoad]:
  if node is None:
    return False

  if node in ctx.visited:
    return False
  ctx.visited.append(node)

  
  # check load from storage
  if node.type == NodeType.VARIABLE:
    if len(node.irs) == 1:
      ir = node.irs[0]
      if isinstance(ir, Assignment):
        rval = ir.rvalue
        lval = ir.lvalue
        if isinstance(rval, StateVariable) and isinstance(lval, LocalVariable):
          ctx.vars_state_load.append(StorageLoad(lval, rval))

  # check write to storage
  if node.type == NodeType.EXPRESSION:
    for ir in node.irs:
      if isinstance(ir, Assignment):
        lval = ir.lvalue
        if isinstance(lval, StateVariable):
          # remove lval state var from vars_state_load
          for vsl in ctx.vars_state_load[:]:
            if vsl.storage_var == lval:
              ctx.vars_state_load.remove(vsl)

  # check function calls parameters
  for ir in node.irs:
    if isinstance(ir, InternalCall) or isinstance(ir, HighLevelCall):
      # get params, remove from vars_state_load
      call_args = ir.arguments
      for arg in call_args:
        for vsl in ctx.vars_state_load[:]:
          if vsl.memory_var == arg:
            ctx.vars_state_load.remove(vsl)

  if not len(node.sons):
    return ctx.vars_state_load

  ret = []
  for son in node.sons:
      ret += check_function(son, ctx)
  return ret


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
          f"Found unused memory var '",
          sl.memory_var,
          "' loaded from storage var '",
          sl.storage_var,
          "'\n"
        ]
        res = self.generate_result(info)
        results.append(res)

      return results         

