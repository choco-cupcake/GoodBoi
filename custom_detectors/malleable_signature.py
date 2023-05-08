import copy
from typing import List, Optional
from slither.core.cfg.node import Node
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.declarations import Contract, Function
from slither.slithir.operations import SolidityCall, InternalCall
from slither.utils.output import Output

class Context():
    def __init__(self):
        self.visited = []
        self.s_checked = False

    def __str__(self): # debug
        return 'param' + str(self.param)

       

# widespread false positives
banned_funcs = []
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
    not any(y in x.name for y in banned_funcs_partial) and
    x.visibility in ["public", "external"] and # internal functions inspected through internal calls to keep the flow consistent
    x.is_implemented))

  for f in to_inspect: 
    if check_function(f.entry_point, Context()): 
      results_raw.append(f)
  return results_raw


def check_function(node: Optional[Node], ctx: Context):
  if node is None:
    return False

  if node in ctx.visited:
    return False
  ctx.visited.append(node)

  # s check
  if "0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0" in str(node): # lazy, ugly, effective
    ctx.s_checked = True
  
  # ecrecover
  if is_ecrecover(node) and not ctx.s_checked:
    return True

  # internal calls
  for ir in node.irs:
    if isinstance(ir, InternalCall):
      if check_function(ir.function.entry_point, copy.copy(ctx)):
        return True

  # sons inspection
  ret = False
  for son in node.sons:
      ret = ret or check_function(son, copy.copy(ctx))
  return ret

def is_ecrecover(node: Node) -> bool:
  for ir in node.irs:
    if(isinstance(ir, SolidityCall)):
      fname = ir.function.name
      if fname == "ecrecover(bytes32,uint8,bytes32,bytes32)":
        return True
  return False

def get_inherited_contracts(contract: Contract) -> List[str]:
    return list(x.name for x in contract.inheritance)

class MalleableSignature(AbstractDetector):

    ARGUMENT = "malleable-signature"
    HELP = "OZ ECDSA not implemented"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.LOW

    WIKI = "-"

    WIKI_TITLE = "malleable-signature"
    WIKI_DESCRIPTION = "-"

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
          f"Found unprotected ecrecover in function ",
          f,
          "\n"
        ]
        res = self.generate_result(info)
        results.append(res)

      return results         

