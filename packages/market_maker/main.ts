import { Transaction } from "@mysten/sui/transactions";
import { MarketMaker } from "./marketMaker";
// import fetch from "node-fetch";


(async () => {
    const mm = new MarketMaker();
    // await mm.createAndShareBM();
    await mm.checkBalances();
    const tx = new Transaction();
    await mm.borrowAndReturnFlashloan(tx, "DEEP_SUI", 1);
    await mm.signAndExecute(tx);
    // await mm.depositCoins(1000, 1000, 1000, 1000);
    // await mm.checkBalances();
    // await mm.withdrawCoins();

    // stake
    // await mm.checkBalances();
    // const tx = new Transaction();
    // mm.stake(tx, "DEEP_SUI", 500);
    // await mm.unstake(tx, "DEEP_SUI");
    // mm.stake(tx, "SUI_DBUSDC", 1000);
    // mm.stake(tx, "DEEP_DBUSDC", 1000);
    // mm.stake(tx, "DBUSDT_DBUSDC", 1000);

    // await mm.signAndExecute(tx);
    // await mm.checkBalances();

    // await mm.checkBalances();
    // let response = await fetch("https://api.dexscreener.com/latest/dex/pairs/sui/0x5eb2dfcdd1b15d2021328258f6d5ec081e9a0cdcfa9e13a0eaeb9b5f7505ca78");
    // let json = await response.json();
    // let pair = json.pairs[0];
    // let priceUsd = pair.priceUsd;
    
    // let suiPrice = Math.round(priceUsd * 100) / 100;
    // let deepsuiPrice = Math.round((1 / suiPrice) * 100) / 100;
    // console.log(`SUI price: ${suiPrice}, DEEP_SUI price: ${deepsuiPrice}`);

    // await mm.printBook("DEEP_SUI");
    // await mm.printBook("SUI_DBUSDC");
    // await mm.printBook("DEEP_DBUSDC");
    // await mm.printBook("DBUSDT_DBUSDC");
    // const tx = new Transaction();
    // tx.add(mm.client.deepBook.claimRebates("SUI_DBUSDC", "MANAGER_1"));
    // const res = await mm.signAndExecute(tx);
    // console.log(res);

    // const tx = new Transaction();
    // await mm.placeOrder(tx, "DEEP_SUI", 0.98, 10, true);
    // await mm.placeOrder(tx, "DEEP_SUI", 1.02, 10, false);
    // await mm.placeOrdersAroundMid(tx, "DEEP_SUI", 10, 25, deepsuiPrice);
    // await mm.placeOrdersAroundMid(tx, "SUI_DBUSDC", 10, 25, suiPrice);
    // await mm.placeOrdersAroundMid(tx, "DEEP_DBUSDC", 10, 25, 1);
    // await mm.placeOrdersAroundMid(tx, "DBUSDT_DBUSDC", 10, 25, 1);
    // await mm.signAndExecute(tx);
    // await mm.checkBalances();

    // await mm.printBook("DEEP_SUI");
    // await mm.printBook("SUI_DBUSDC");
    // await mm.printBook("DEEP_DBUSDC");
    // await mm.printBook("DBUSDT_DBUSDC");
})();