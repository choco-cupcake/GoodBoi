// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import './interfaces/IUniswapV3Factory.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IWeightedPool2TokensFactory.sol';
import './interfaces/IUniswapV3Pool.sol';	
import './interfaces/IERC20.sol';	
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArbiFlagger is Ownable{
    address constant WETH = address(0x82af49447d8a07e3bd95bd0d56f35241523fbab1);
    IUniswapV3Factory constant uniV3Factory = IUniswapV3Factory(0x1f98431c8ad98523631ae4a59f267346ea31f984);

    uint256 gasMargin = 60000;

    struct Input{
        address _contract;
        address[] internalAddresses;
    }
    struct Output{
        address _contract;
        uint8 flag;
    }
 
    function setGasMargin(uint256 gm) external onlyOwner{
        gasMargin = gm;
    }
 
    function areInterestingContract(Input[] calldata contracts, uint256 minPoolWeth) public returns (Output[] memory){
        uint256 _gasMargin = gasMargin;
        Output[] memory res = new Output[](contracts.length);
        for(uint256 i=0; i < contracts.length; ){	
            if(gasleft() < _gasMargin){	
                return res;	
            }
            res[i]._contract = contracts[i]._contract;
            uint8 _flag = isInterestingContract(contracts[i]._contract, contracts[i].internalAddresses, minPoolWeth, _gasMargin);
            if(_flag == 2){
                return res;
            }
            res[i].flag = _flag;	
            unchecked{	
                i++;	
            }
        }
        return res;
    }

    function isInterestingContract(address mainContract, address[] calldata internalAddresses, uint256 minPoolWeth, uint256 _gasMargin) public returns (uint8){
        if(hasPool(mainContract, minPoolWeth)){
            return 1;
        }
        for(uint256 i=0; i < internalAddresses.length; i++){
            if(gasleft() < _gasMargin){
                return 2;
            }	
            if(!isContract(internalAddresses[i])){ // try/cath does not catch calls to non contracts	
                continue;	
            }
            if(isPool(internalAddresses[i], minPoolWeth) || hasPool(internalAddresses[i], minPoolWeth)){
                return 1;
            }
        }
        return 0;
    }

    function isPool(address inpAddr, uint256 minPoolWeth) public returns (bool){
      if(isUniswapV3Pool(inpAddr)){
        return true;
      }
      return false;
    }

    function isUniswapV3Pool(address poolAddr) public returns (bool){
      try IUniswapV3Pool(poolAddr).maxLiquidityPerTick() returns (uint128 mlpt){	
            if(mlpt > 0){	
                return true;	
            }
      }
      catch{}
      return false;
    }

    // returns true if inpAddr is ERC20 and has an associated pool, with a check on the liquidity where doable
    function hasPool(address inpAddr, uint256 minPoolWeth) public returns (bool){
        if(isERC20(inpAddr) && hasPoolUniV3(inpAddr))
            return true;
        return false;
    }

    function hasPoolUniV3(address inpAddr) public returns (bool){	
        uint24[] memory uniV3Fees = new uint24[](3);	
        uniV3Fees[0] = 3000;	
        uniV3Fees[1] = 10000;	
        uniV3Fees[2] = 500;
        for(uint8 i=0; i<uniV3Fees.length; i++){
            if(uniV3Factory.getPool(inpAddr, WETH, uniV3Fees[i]) != address(0)){
                return true;
            }
        }
        return false;
    }

    function isERC20(address inpAddr) public returns (bool){
        try IERC20(inpAddr).allowance(address(this), address(this)){
            return true;
        }
        catch{
            return false;
        }
    }

    function isContract(address account) internal view returns (bool) {	
        return account.code.length > 0;	
    }

}