import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MiniWorldModule = buildModule("MiniWorldModule", (m) => {
  const miniWorld = m.contract("MiniWorld");
  
  return { miniWorld };
});

export default MiniWorldModule;