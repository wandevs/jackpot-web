
export const mainnetSCAddr = '';//mainnet 8 hours smart contract
export const testnetSCAddr = '0x9c6F5b86595DA99a769217af38B6599ebA1806EF';//testnet 8 hours smart contract

// change networkId to switch network
export const networkId = 3; //1:mainnet, 3:testnet;

// export const nodeUrl = networkId == 1 ? "https://gwan-ssl.wandevs.org:56891" : "http://192.168.1.179:54320";
// export const nodeUrl = networkId == 1 ? "https://gwan-ssl.wandevs.org:56891" : "https://molin.tech:16666";
export const nodeUrl = networkId == 1 ? "https://gwan-ssl.wandevs.org:56891" : "http://192.168.1.89:8545";

// export const nodeUrl = networkId == 1 ? "https://mywanwallet.io/api" : "https://demodex.wandevs.org:48545";

// export const nodeUrl = networkId == 1 ? "https://gwan-ssl.wandevs.org:56891" : "https://demodex.wandevs.org:48545";
export const price = 10;

export const defaultStartBlock = 0;