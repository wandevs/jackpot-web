import { message } from 'antd';
import BigNumber from 'bignumber.js';

export const toUnitAmount = (amount, decimals) => {
  return new BigNumber(amount).div(Math.pow(10, decimals));
};

export const alertAntd = (info) => {
  if (typeof (info) === "string" && !info.includes('Error')) {
    message.success(info, 10);
  } else {
    if (info.toString().includes("Error")) {
      message.error(info.toString(), 10);
    } else if (info.hasOwnProperty('tip')) {
      message.info(info.tip, 5);
    } else {
      message.warning(JSON.stringify(info), 10);
    }
  }
}

export const formatRaffleNumber = (num, len = 4) => {
  num = num.toString();
  return num.length === 4 ? num : num.padStart(len, '0');
}

export const keepOneDecimal = (num) => {
  return new BigNumber(num).decimalPlaces(1).toString();
}