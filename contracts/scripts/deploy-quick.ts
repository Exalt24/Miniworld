import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function updateEnvFile(
  envPath: string, 
  contractAddress: string, 
  envName: string, 
  prefix: string = ''
): void {
  const varName = `${prefix}CONTRACT_ADDRESS`;
  const varPattern = new RegExp(`${prefix}CONTRACT_ADDRESS=.*`);
  
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
   
    if (envContent.includes(`${varName}=`)) {
      envContent = envContent.replace(
        varPattern,
        `${varName}=${contractAddress}`
      );
    } else {
      envContent += `\n${varName}=${contractAddress}\n`;
    }
   
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated ${envName} with ${varName}`);
  } else {
    console.warn(`⚠️  ${envName} not found, creating new file...`);
    const templatePath = path.join(path.dirname(envPath), '.env.example');
    let envContent = '';
   
    if (fs.existsSync(templatePath)) {
      envContent = fs.readFileSync(templatePath, 'utf8');
      if (envContent.includes(`${varName}=`)) {
        envContent = envContent.replace(
          varPattern,
          `${varName}=${contractAddress}`
        );
      } else {
        envContent += `\n${varName}=${contractAddress}\n`;
      }
    } else {
      envContent = `${varName}=${contractAddress}\n`;
    }
   
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Created ${envName} with ${varName}`);
  }
}

async function main() {
  console.log('📝 Reading Ignition deployment artifacts...\n');
  
  const deploymentPath = path.join(
    __dirname, 
    '../ignition/deployments/chain-31337/deployed_addresses.json'
  );
 
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment artifacts not found!');
    console.error('   Run: npm run deploy');
    console.error('   Then run this script again.\n');
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployedAddresses['MiniWorldModule#MiniWorld'];

  if (!contractAddress) {
    console.error('❌ MiniWorld contract address not found in deployment artifacts!');
    process.exit(1);
  }

  console.log(`📍 Found MiniWorld contract: ${contractAddress}\n`);

  const backendEnvPath = path.join(__dirname, '../../backend/.env');
  const gameClientEnvPath = path.join(__dirname, '../../game-client/.env');
  const creatorDashboardEnvPath = path.join(__dirname, '../../creator-dashboard/.env');

  // Backend uses plain CONTRACT_ADDRESS
  updateEnvFile(backendEnvPath, contractAddress, 'backend/.env');
  
  // Game client and creator dashboard use VITE_CONTRACT_ADDRESS
  updateEnvFile(gameClientEnvPath, contractAddress, 'game-client/.env', 'VITE_');
  updateEnvFile(creatorDashboardEnvPath, contractAddress, 'creator-dashboard/.env', 'VITE_');

  console.log('\n✅ All environment files updated!\n');
  console.log('📋 Next steps:');
  console.log('   1. Restart backend server if running: npm run dev');
  console.log('   2. Start game client: cd ../game-client && npm run dev');
  console.log('   3. The Event Listener will automatically index blockchain events\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });