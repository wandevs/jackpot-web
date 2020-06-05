import Web3 from 'web3';
import { networkId } from './config';

let nodeUrlsTestnet = [
    'wss://apitest.wanchain.org:8443/ws/v3/627f78bd371c3980a8782a505ffb7ec263ae0031213bb0cd2d10ed32e25b4f29',
    'https://gwan-ssl.wandevs.org:46891',
    'https://demodex.wandevs.org:48545',
];

let nodeUrlsMainnet = [
    'wss://api.wanchain.org:8443/ws/v3/627f78bd371c3980a8782a505ffb7ec263ae0031213bb0cd2d10ed32e25b4f29',
    'wss://api2.wanchain.org:8443/ws/v3/627f78bd371c3980a8782a505ffb7ec263ae0031213bb0cd2d10ed32e25b4f29',
    'https://wandex.org/rpc',
]

let nodeUrls = networkId === 1 ? nodeUrlsMainnet : nodeUrlsTestnet;

let web3s = [];
let web3select = 0;
let switchFinish = false;

console.log('ready to new web3...');
for (let i=0; i<nodeUrls.length; i++) {
    try {
        if (nodeUrls[i].indexOf('ws') === 0) {
            web3s.push(new Web3(new Web3.providers.WebsocketProvider(nodeUrls[i], {timeout: 5e3})));
        } else {
            web3s.push(new Web3(new Web3.providers.HttpProvider(nodeUrls[i], {timeout: 5e3})));
        }
    } catch (err) {
        console.log(err);
    }
}

export const getFastWeb3 = async () => {
    console.log('Search fast web3...');
    let funcs = [];
    for (let i=0; i<web3s.length; i++) {
        let func = async () => {
            let t0 = Date.now();
            try {
                await web3s[i].eth.net.getId();
            } catch (err) {
                console.log('net error:', i, nodeUrls[i]);
                return {delay: 100000, index: i};
            }
            let t1 = Date.now() - t0;
            return {delay: t1, index: i};
        }
        funcs.push(await func());
    }
    console.log('ready to run...');
    let ret = await Promise.all(funcs);
    ret.sort((a, b)=>(a.delay - b.delay));
    console.log(ret);
    web3select = ret[0].index;
    // web3select = ret.index;
    console.log('web3select', web3select, nodeUrls[web3select]);
    switchFinish = true;
}

export const getWeb3 = () => {
    return web3s[web3select];
}

export const getNodeUrl = () => {
    return nodeUrls[web3select];
}

export const isSwitchFinish = () => {
    return switchFinish;
}

getFastWeb3();

