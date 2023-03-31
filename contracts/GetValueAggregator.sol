// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

contract GetValueAggregator{

    struct InputObj{
        address contractAddress;
        bytes4 getterSelector;
    }

    struct OutputVariableObj{
        address contractAddress;
        bytes4 getterSelector;
        address readVal;
    }

    struct OutputMappingObj{
        address contractAddress;
        bytes4 getterSelector;
        address[] readVal;
    }
    
    function getVarValue(InputObj[] calldata input) external returns (OutputVariableObj[] memory){
        uint256 inpLen = input.length;
        address ret;
        bool success;
        bytes memory resultBytes;
        OutputVariableObj[] memory output = new OutputVariableObj[](inpLen);
        for(uint256 i=0; i<inpLen; i++){
            (success, resultBytes) = address(input[i].contractAddress).call(abi.encodePacked(input[i].getterSelector));
            if(success){
                ret = abi.decode(resultBytes, (address));
            }
            else{
                ret = address(0);
            }
            output[i] = OutputVariableObj(input[i].contractAddress, input[i].getterSelector, ret);
        }
        return output;
    }
    
    function getMappingValue(InputObj[] calldata input) external returns (OutputMappingObj[] memory){
        uint256 inpLen = input.length;
        address ret;
        bool success;
        bytes memory resultBytes;
        OutputMappingObj[] memory output = new OutputMappingObj[](inpLen);
        for(uint256 i=0; i<inpLen; i++){
            address[] memory buffer = new address[](5);
            for(uint j=0; j<5; j++){
                (success, resultBytes) = address(input[i].contractAddress).call(abi.encodePacked(input[i].getterSelector, j));
                if(success){
                    ret = abi.decode(resultBytes, (address));
                    if(ret == address(0))
                        break;
                }
                else{
                    break;
                }
                buffer[j] = ret;
            }
            output[i] = OutputMappingObj(input[i].contractAddress, input[i].getterSelector, buffer);
        }
        return output;
    }
}