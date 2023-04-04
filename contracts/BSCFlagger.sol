// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

contract BSCFlagger is Ownable{
    address constant WETH = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    IUniswapV2Factory constant PancakeswapFactory = IUniswapV2Factory(0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73);

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

    // returns: 0=false 1=true 2=incomplete
    function isInterestingContract(address mainContract, address[] calldata internalAddresses, uint256 minPoolWeth, uint256 _gasMargin) public returns (uint8){
        if(isERC20(mainContract) && (hasPoolPancakeswap(mainContract, minPoolWeth))){
            return 1;
        }
        for(uint256 i=0; i < internalAddresses.length; i++){
            if(gasleft() < _gasMargin){
                return 2;
            }
            if(!isContract(internalAddresses[i])){ // try/cath does not catch calls to non contracts	
                continue;	
            }
            if(isPoolPancakeswap(internalAddresses[i], minPoolWeth) || hasPoolPancakeswap(internalAddresses[i], minPoolWeth)){
                return 1;
            }
        }
        return 0;
    }

    function hasPoolPancakeswap(address inpAddr, uint256 minPoolWeth) public returns (bool){
        address pool = PancakeswapFactory.getPair(inpAddr, WETH);
        if(pool != address(0)){
            return isPoolPancakeswap(pool, minPoolWeth);
        }
        return false;
    }

    function isPoolPancakeswap(address pool, uint256 minPoolWeth) public returns (bool){
        uint112 reserve0; uint112 reserve1;
        address token0;
        try IUniswapV2Pair(pool).getReserves() returns (uint112 _reserve0, uint112 _reserve1, uint32 ){
            reserve0 = _reserve0;
            reserve1 = _reserve1;
        }
        catch{
            return false;
        }
        try IUniswapV2Pair(pool).token0() returns (address _token0){
            token0 = _token0;
        }
        catch{
            return false;
        }
        if(token0 == WETH){
            if(reserve0 > minPoolWeth){
                return true;
            }
        } else{
            if(reserve1 > minPoolWeth){
                return true;
            }
        }
        return false;
    }

    function isContract(address account) internal view returns (bool) {	
        return account.code.length > 0;	
    }
    
    function isERC20(address inpAddr) public returns (bool){
        try IERC20(inpAddr).allowance(address(this), address(this)){
        return true;
        }
        catch{
            return false;
        }
    }
}