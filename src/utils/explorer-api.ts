import Bluebird from "bluebird";
import { ETHERSCAN_API_KEYS, ETHERSCAN_API_URL } from "../config";

export const submitVerification = async (verificationInfo: any, chainId: number, etherscanUrl?: string) => {
    const request = await fetch(etherscanUrl || ETHERSCAN_API_URL[chainId], {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(verificationInfo).toString(),
    });

    return await request.json();
};

// checks if the smart contract is already verified before trying to verify it
export const checkIfVerified = async (
    deploymentAddress: string,
    chainId: number,
    etherscanApi?: string,
    etherscanApiKey?: string
) => {
    let contractABI;
    const params = {
        apikey: etherscanApiKey || ETHERSCAN_API_KEYS[chainId],
        address: deploymentAddress,
        module: 'contract',
        action: 'getabi',
    };

    const formattedParams = new URLSearchParams(params).toString();

    const request = await fetch(`${etherscanApi || ETHERSCAN_API_URL[chainId]}?${formattedParams}`);

    const { status, result }: any = await request.json();

    if (status !== '0') {
        try {
            contractABI = JSON.parse(result);
        } catch (e) {
            console.log(`Couldn't parse the abi from ${deploymentAddress}`);
            return;
        }
    }

    return contractABI && contractABI !== '';
};

export const checkIfVisible = async (
    deploymentAddress: string,
    chainId: number,
    etherscanApiUrl?: string,
    etherscanApiKey?: string
) => {
    const params = {
        apikey: etherscanApiKey || ETHERSCAN_API_KEYS[chainId],
        contractaddresses: deploymentAddress,
        module: 'contract',
        action: 'getcontractcreation',
    };

    const formattedParams = new URLSearchParams(params).toString();

    await Bluebird.delay(100);
    const request = await fetch(
        `${etherscanApiUrl || ETHERSCAN_API_URL[chainId]}?${formattedParams}`
    );
    const { result }: any = await request.json();
    return Boolean(result);
};

/*
   Etherscan needs time to process the deployment, depending of the network load could take more or less time.
*/
export const waitTillVisible = async (
    deploymentAddress: string,
    chainId: number,
    etherscanUrl?: string,
    etherscanApiKey?: string
): Promise<void> => {
    let visible: Boolean = false;
    const sleepTime = 1000 * 5;
    let logged = false;
    while (!visible) {
        visible = await checkIfVisible(deploymentAddress, chainId, etherscanUrl, etherscanApiKey);
        if (!visible) {
            if (!logged) {
                console.log('Waiting for on-chain settlement...');
                logged = true;
            }
            await Bluebird.delay(sleepTime)
        }
    }
};


/**
    Status response:
     0: Error in the verification
     1: Verification completed
     2: Verification pending
*/
export const checkVerificationStatus = async (
    GUID: string,
    chainId: number,
    etherscanUrl?: string,
    apiKey?: string
): Promise<{
    status: number;
    message: string;
}> => {
    const params = {
        apikey: apiKey || ETHERSCAN_API_KEYS[chainId],
        guid: GUID,
        module: 'contract',
        action: 'checkverifystatus',
    };

    const formattedParams = new URLSearchParams(params).toString();

    try {
        const request = await fetch(`${etherscanUrl || ETHERSCAN_API_URL[chainId]}?${formattedParams}`);

        const { status, result }: any = await request.json();
        if (result === 'Pending in queue') {
            return {
                status: 2,
                message: result,
            };
        }
        if (result !== 'Fail - Unable to verify') {
            if (status === '1') {
                return {
                    status: 1,
                    message: result,
                };
            }
        }
        return {
            status: 0,
            message: result,
        };
    } catch (err) {
        return {
            status: 2,
            message: `Couldn't check the verification status. Err: ${err}`,
        };
    }
};