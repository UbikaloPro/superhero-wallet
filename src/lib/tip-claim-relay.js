import axios from 'axios';
import { uniq } from 'lodash-es';
import { DEFAULT_NETWORK, networks, TIPPING_CONTRACT, TIP_SERVICE } from '../popup/utils/constants';
import {
  contractCallStatic,
  getActiveAccount,
  getAddressFromChainName,
  getTippingContractAddress,
} from './background-utils';
import Logger from './logger';

export default {
  checkAddressMatch(account, addresses) {
    return account === addresses || (Array.isArray(addresses) && addresses.includes(account));
  },

  async abortIfZeroClaim(url) {
    const tippingAddress = networks[DEFAULT_NETWORK].tipContract;
    const address = await getTippingContractAddress(tippingAddress);
    const tx = {
      method: 'unclaimed_for_url',
      address,
      params: [url],
      source: TIPPING_CONTRACT,
    };

    const claimAmount = await contractCallStatic({ tx, callType: 'static' })
      .then(r => r.decodedResult)
      .catch(error => {
        Logger.write(error);
        return 1;
      });
    if (claimAmount === 0) throw new Error('No new tips to claim');
  },

  async checkUrlHasBalance(url, { address, chainName }) {
    try {
      const { account } = await getActiveAccount();
      if (account && account.publicKey) {
        let addresses = [address];
        if (Array.isArray(address)) addresses = address;

        if (chainName) {
          const pubKeys = await getAddressFromChainName(uniq(chainName));
          addresses = [...addresses, ...pubKeys];
        }

        if (this.checkAddressMatch(account.publicKey, uniq(addresses))) {
          await this.abortIfZeroClaim(url);

          await axios.post(`${TIP_SERVICE}`, { url, address: account.publicKey });
        }
      }
    } catch (e) {
      e.payload = { url };
      Logger.write(e);
    }
  },
};
