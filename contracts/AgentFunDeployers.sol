// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Agent404.sol";
import "./AgentFunCurve.sol";

/// @title AgentFunChildDeployer — creation-code host for DN-404 children.
/// @notice Exists purely so the factories' deployed runtime stays under
///         the 24,576-byte BSC code-size limit: the Agent404 creation code
///         (which itself embeds DN404 + DN404Mirror) lives here instead of
///         inside AgentFunFactoryV2. Stateless and permissionless — it
///         deploys the public, unmodified Agent404 with exactly the
///         parameters the caller passes; anyone could deploy the same
///         child directly, so there is nothing privileged to gate.
contract AgentFunChildDeployer {
    /// @notice Deploy an unmodified Agent404 child.
    /// @return token The child token contract.
    /// @return mirror The child's DN404 mirror (badge collection).
    function deployChild(
        string memory name,
        string memory symbol,
        uint256 supply,
        address supplyOwner,
        address agentRegistry
    ) external returns (address token, address mirror) {
        Agent404 child = new Agent404(name, symbol, supply, supplyOwner, agentRegistry);
        token = address(child);
        mirror = child.mirrorERC721();
    }
}

/// @title AgentFunCurveDeployer — creation-code host for AgentFun curves.
/// @notice Same size rationale as AgentFunChildDeployer: the AgentFunCurve
///         creation code lives here, not inside AgentFunFactoryV2.
///         Stateless and permissionless — a curve holds nothing and trusts
///         nobody until a factory funds it with a child's supply, so
///         deploying one directly is harmless.
contract AgentFunCurveDeployer {
    /// @notice Deploy an AgentFunCurve wired exactly as the parameters say.
    /// @return curve The deployed curve contract.
    function deployCurve(
        address token,
        address creator,
        address reserveWallet,
        address pancakeFactory,
        address pancakeRouter,
        address wbnb
    ) external returns (address curve) {
        AgentFunCurve deployed =
            new AgentFunCurve(token, creator, reserveWallet, pancakeFactory, pancakeRouter, wbnb);
        curve = address(deployed);
    }
}
