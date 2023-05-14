from typing import List, Optional
from slither.core.cfg.node import NodeType, Node
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification
from slither.core.variables.local_variable import LocalVariable
from slither.core.variables.state_variable import StateVariable
from slither.slithir.operations import Length, Index
from slither.core.declarations import Contract, Function
from slither.core.declarations.function_contract import FunctionContract
from slither.core.expressions.call_expression import CallExpression, Expression
from slither.utils.output import Output
from slither.analyses.data_dependency.data_dependency import is_dependent

from slither.slithir.operations import (
    HighLevelCall,
    LibraryCall,
    LowLevelCall,
    Send,
    Transfer,
    InternalCall,
    SolidityCall,
    Binary,
    BinaryType
)

class Hit():
    def __init__(self, var_name, var_type, func_name, entry_point: Function):
        self.var_name = var_name
        self.var_type = var_type
        self.func_name = func_name
        self.entry_point = entry_point

    def __eq__(self, other):
        return self.var_name==other.var_name\
            and self.var_type==other.var_type\
            and self.func_name==other.func_name\
            and self.entry_point.name==other.entry_point.name

    def __hash__(self):
        return hash(('var_name' + self.var_name,
            'var_type', self.var_type,
            'func_name', self.func_name,
            'entry_point', self.entry_point.name))
    
    def __str__(self):
        return 'var_name' + self.var_name + ' - var_type' + self.var_type + ' - func_name' + self.func_name + ' - entry_point' + self.entry_point.name

coveredFunctions = []

# widespread false positives
# recursive
banned_funcs = ["transfer", "_transfer", "transferfrom", 'safetransferfrom', "transferpermit", "transferwithpermit", 'constructor', "burn", "_burn", "initialize"]
# recursive, partial (LIKE %x%)
banned_funcs_partial = ['init'] 

# widespread false positives
whitelisted_vars = ['allLendingPools', 'poolData', 'queue', 'slot0', 'triggerTime', 'totalSupply', '_totalSupply', 'currentTime', 'my_user_value', 'hashes', 'fundsDestination']
whitelisted_vars_partial = ['last', 'latest', 'next']

def reset_covered_functions():
    global coveredFunctions
    coveredFunctions = ['settle', 'notifyReward', 'createVault', 'claimStakerReward','claimReward', 
    'claimStakerRewards', 'claimRewards', '_reduceReserves', 'notifyRewards', '_reduceReserves', 
    'createPair', 'updateUserDiscount'] # functions to be ignored without killing branch

def get_banned_funcs() -> List[str]:
    return banned_funcs

def is_protected(func: Function, recursion_covered_funcs = []) -> bool:
    if func.solidity_signature in recursion_covered_funcs:
        return True
    else:
        recursion_covered_funcs.append(func.solidity_signature)
    if(is_modifier_protected(func)): # checks for role restriction modifiers
        return True
    if(checks_msg_sender(func)): # checks for require statement involving msg.sender whether as a var or used in mappings, whatever the check
        return True
    # recursive check
    ret = False
    for f in (func.internal_calls + func.modifiers): # no protected modifiers, no protected functions down the call chain
        if(isinstance(f, Function)): # internal calls, exclude variables
            ret = ret or is_protected(f, recursion_covered_funcs)
    return ret

def is_public_or_external(func: Function) -> bool:
    return func.visibility in ["public", "external"]

def checks_msg_sender(func: Function) -> bool:
    for node in func.nodes:
        for ir in node.irs:
            # is_require_node(node) removed because of too many misses. msg.sender is often checked implicitly 
            # e.g. triggering underflows on mappings[msg.sender]
            # for this specific use case it's okish to skip any reference of msg.sender/tx.origin
            if(is_msg_sender_in_IR(ir)): 
                return True

def is_require_node(n: Node) -> bool:
    for ir in n.irs:
        if(isinstance(ir, SolidityCall)):
            fname = ir.function.name
            if(fname in ["require(bool,string)", "require(bool)"]):
                return True
    return False

def is_msg_sender_in_IR(ir) -> bool:
    if any(x in str(ir).lower() for x in ["msg.sender", "msgsender", "tx.origin", "txorigin"]): # brutal but good fit for the job
        return True
    return False

def is_modifier_protected(func: Function) -> bool:
    bannedPattern = ['admin', 'owner', 'role', 'only', 'has', 'can', 'permission', 'initializ', 'auth']
    for mod in func.modifiers:
        for ban in bannedPattern:
            if ban in str(mod).lower():
                return True
    return False

def contains_banned_funcs(func: Function, recursion_covered_funcs = []):
    if func.solidity_signature in recursion_covered_funcs:
        return True
    else:
        recursion_covered_funcs.append(func.solidity_signature)
    # checks all the calls tree recursively
    ret = False
    for f in func.internal_calls:
        if(isinstance(f, Function)): # internal calls, exclude variables - in case the contract is ERC20 itself
            if (any(x == f.name.lower() for x in banned_funcs) or 
                any(x in f.name.lower() for x in banned_funcs_partial)):
                return True
            else:
                ret = ret or contains_banned_funcs(f, recursion_covered_funcs)
    for f in func.high_level_calls: # external calls
        if isinstance(f[1], Function):
            if any(x in f[1].name.lower() for x in banned_funcs):
                return True
    return ret

def contains_ecrecover(func: Function, recursion_covered_funcs = []):
    if func.solidity_signature in recursion_covered_funcs:
        return True
    else:
        recursion_covered_funcs.append(func.solidity_signature)
    ret = False
    for node in func.nodes:
        for ir in node.irs:
            if(isinstance(ir, SolidityCall)):
                fname = ir.function.name
                if fname == "ecrecover(bytes32,uint8,bytes32,bytes32)":
                    return True
            elif isinstance(ir, InternalCall):
                ret = ret or contains_ecrecover(ir.function, recursion_covered_funcs)
            elif isinstance(ir, HighLevelCall):
                    if ir.function_name in ["verify"]:
                        return True
    return ret

def check_function(contractsInherited: List[str], func: Function, entryPoint = None, taintedParams = []):
    # outer level means first call in the function calls chain
    outerLevel = entryPoint == None
    if outerLevel: 
        if (
            func.name in contractsInherited or # older solidity constructors
            func.name in coveredFunctions or # undesired functions set in reset_covered_functions()
            not is_public_or_external(func) or # return for unreachable functions
            not func.is_implemented or # returns for unimplemented functions
            func.payable or # returns for payable functions
            contains_banned_funcs(func) or # [recursive] we don't want any transferFrom() down the call chain
            is_protected(func) or # [recursive] no msg.sender in func body, no modifiers checking msg.sender, no modifiers in ban list
            contains_ecrecover(func) # thats a form of authentication
            ):
            return []
        # sets entry point
        entryPoint = func
        # sets params as taintedParams
        taintedParams = func.parameters

    # fill report with findings
    results = report_vars_written(func, entryPoint, taintedParams) 
    coveredFunctions.append(func.name) 
    # look for internal calls with at least one argument dependant on any of taintedParams
    for n in func.nodes:
        for ir in n.irs:
            if(isinstance(ir, InternalCall)): # internal call IR
                if(ir.function_name not in coveredFunctions): # not a dead branch
                    call_args = ir.arguments # callee arguments
                    # get callee arguments dependant on taintedParams in the context of func
                    tainted_call_args = get_dependant_arguments(call_args, taintedParams, func) 
                    # recursive check
                    results += check_function(contractsInherited, ir.function, entryPoint, tainted_call_args) 
    
    return results

def get_dependant_arguments(callee_args: List[LocalVariable], caller_params: List[LocalVariable], func: Function):
    ret = []
    for ca in callee_args:
        for cp in caller_params:
            if is_dependent(ca, cp, func) and ca not in ret:
                ret.append(ca)
    return ret

def is_dependent_on_any(callee_arg: LocalVariable, caller_params: List[LocalVariable], func: Function):
    ret = []
    for cp in caller_params:
        if is_dependent(callee_arg, cp, func):
            return True
    return False


def report_vars_written(func: Function, entry_point: Function, taintedParams) -> List[Hit]:
    results: List[Hit] = []
    written_by_modifiers = [] # temporarily removed feature (to be tested) - state_vars_written_by_modifiers(func)
    vars_set_to_true = vars_set_true(func)
    for sv in (x for x in func.state_variables_written if x.name not in whitelisted_vars):
        # check partial names
        if any(sv.name.lower()[0:len(x)] == x for x in whitelisted_vars_partial):
            continue

        if is_dependent_on_any(sv, taintedParams, func): # only flag vars dependant on tainted params
            if not is_checked_equals_zero_or_initialized(sv.name, func, vars_set_to_true):
                if hasattr(sv, "type"):
                    var_type = "mapping" if str(sv.type)[0:7] == "mapping" else "state variable"
                    res = Hit(sv.name, var_type, func.name, entry_point)
                    results.append(res)
    return results

def vars_set_true(func: Function): 
    # this leaves some false positives where a non bool variable (e.g. address) gets set and checked in the same function 
    # with others vars. could be fixed but false pos are few and its time to move to other detectors
    ret = []
    for n in func.nodes:
        if n.type == NodeType.EXPRESSION:
            if len(n.irs) == 1: # assignments to true have 1 IR
                irStr = str(n)[11:].replace(" ","")
                if irStr[-5:] == "=true":
                    ret.append(irStr[:-5])
    return ret


def is_checked_equals_zero_or_initialized(var_name, func: Function, vars_set_to_true) -> bool:
    for n in func.nodes:
        if _is_checked_equals_zero_or_initialized(n, var_name, vars_set_to_true):
            return True
    return False

def _is_checked_equals_zero_or_initialized(node: Node, var_name, vars_set_to_true) -> bool:
    for ir in node.irs:
        if isinstance(ir, SolidityCall) and ir.function.name in ["require(bool,string)", "require(bool)"]:
            nodeStr = str(node)[11:].replace(" ", "")
            # check 1: var checked against 0 or address(0)
            patterns = [var_name + "==" + "0", var_name + "==" + "address(0)", "address(" + var_name + ")" + "==" + "address(0)"]
            # check 2: init var initialized
            for vst in vars_set_to_true:
                patterns.append("!" + vst)
                patterns.append(vst + "==false")
            if any(x in nodeStr for x in patterns):
                return True
        elif isinstance(ir, Binary): # binary comparison, to catch if(x != 0) revert/return
            nodeStr = str(node)[3:].replace(" ", "")
            # check 1: var checked against 0 or address(0)
            patterns = [var_name + "!=" + "0", var_name + "!=" + "address(0)", "address(" + var_name + ")" + "!=" + "address(0)"]
            print(nodeStr)
            if any(x in nodeStr for x in patterns):
                return True
    return False

def state_vars_written_by_modifiers(func:Function):
    written_by_modifiers = []
    for mod in func.modifiers:
        written_by_modifiers += (x for x in mod.state_variables_written if x not in written_by_modifiers)
    return written_by_modifiers

def get_inherited_contracts(contract: Contract) -> List[str]:
    return list(x.name for x in contract.inheritance)


class UnprotectedWrite(AbstractDetector):

    ARGUMENT = "unprotected-write"
    HELP = "Detects state variable written from unprotected functions"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.LOW

    WIKI = "-"

    WIKI_TITLE = "Unprotected state write"
    WIKI_DESCRIPTION = "State variables written from unprotected functions"

    # region wiki_exploit_scenario
    WIKI_EXPLOIT_SCENARIO = "www"

    WIKI_RECOMMENDATION = "-"

    def _detect(self) -> List[Output]:
        """"""
        results_raw: List[Hit] = []
        results: List[Output] = []
        banned_functions = get_banned_funcs()
        for c in self.compilation_unit.contracts_derived:
            if any( x in c.name for x in ["Test", "Mock"]): # skip test contracts
                continue
            reset_covered_functions()
            inherited_contracts = get_inherited_contracts(c) + [c.name] # to filter constructors for old solidity versions
            to_inspect = (x for x in c.functions if (x.name not in banned_functions and not any( x.name in y for y in banned_funcs_partial)))
            for f in to_inspect: # filter unwanted funcs (also checked later recursively for nested calls)
                new_results_raw = check_function(inherited_contracts, f)
                results_raw += (x for x in new_results_raw if x not in results_raw)

        for rr in results_raw:
            if rr.var_type == "mapping":
                continue # too many false positives - not suited for the current research
            info = [
                f"Unprotected writable {rr.var_type} '{rr.var_name}' ",
                f"found in {c.name}.{rr.func_name} ",
                f"from entry point ",
                rr.entry_point,
                "\n"
            ]
            res = self.generate_result(info)
            results.append(res)

        return results         
