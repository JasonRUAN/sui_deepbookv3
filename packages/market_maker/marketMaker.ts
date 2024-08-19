// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { DeepBookClient } from "@mysten/deepbook-v3";
import { BalanceManager } from "@mysten/deepbook-v3";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import type { Keypair } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import dotenv from 'dotenv';
dotenv.config();

export class MarketMaker {
    client: DeepBookClient;
    keypair: Keypair;
    constructor() {
        // Pull from env
        const env = "testnet";
        const pk = process.env.PRIVATE_KEY!;
        const keypair = this.getSignerFromPK(pk);

        const balanceManagerAddress = process.env.BALANCE_MANAGER!;

        const balanceManager: BalanceManager = {
            address: balanceManagerAddress,
            tradeCap: undefined
        }

        const client = new DeepBookClient({
            address: keypair.toSuiAddress(),
            env: env,
            client: new SuiClient({
            url: getFullnodeUrl(env),
            }),
            balanceManagers: {"MANAGER_1" : balanceManager},
        })

        this.keypair = keypair;
        this.client = client;
    }

    printBook = async (poolKey: string) => {
        let book = await this.client.getLevel2TicksFromMid(poolKey, 10);

        console.log(poolKey);
        for (let i = book.ask_prices.length - 1; i >= 0; i--) {
            console.log(`${book.ask_prices[i]},\t${book.ask_quantities[i]}`);
        }
        console.log("Price\tQuantity");
        for (let i = 0; i < book.bid_prices.length; i++) {
            console.log(`${book.bid_prices[i]},\t${book.bid_quantities[i]}`);
        }
    }

    midPrice = async (poolKey: string): Promise<number> => {
        let mid = await this.client.midPrice(poolKey);
        console.log(mid);

        return mid;
    }

    placeOrdersAroundMid = async (tx: Transaction, poolKey: string, ticks: number, quantity: number, midPrice: number) => {
        console.log(`Canceling all orders on pool ${poolKey}`);
        tx.add(
            this.client.deepBook.cancelAllOrders(poolKey, "MANAGER_1"),
        );
        
        console.log(`Placing orders for pool ${poolKey} around mid price ${midPrice}`);

        for (let i = 1; i <= ticks; i++) {
            const buyPrice = (Math.round(midPrice * 1000000) - (i * 20000))/1000000;
            const sellPrice = (Math.round(midPrice * 1000000) + (i * 20000))/1000000;
            console.log(buyPrice);
            console.log(sellPrice);
            tx.add(
                this.client.deepBook.placeLimitOrder({
                    poolKey: poolKey,
                    balanceManagerKey: "MANAGER_1",
                    clientOrderId: `${i}`,
                    price: buyPrice,
                    quantity: quantity,
                    isBid: true,
                }),
            );
            tx.add(
                this.client.deepBook.placeLimitOrder({
                    poolKey: poolKey,
                    balanceManagerKey: "MANAGER_1",
                    clientOrderId: `${i}`,
                    price: sellPrice,
                    quantity: quantity,
                    isBid: false,
                }),
            );
        }
    }

    placeOrder = async (tx: Transaction, poolKey: string, price: number, quantity: number, isBid: boolean) => {
        tx.add(
            this.client.deepBook.placeLimitOrder({
                poolKey: poolKey,
                balanceManagerKey: "MANAGER_1",
                clientOrderId: "1",
                price: price,
                quantity: quantity,
                isBid: isBid,
            }),
        );
    }

    checkBalances = async () => {
        const deep = await this.client.checkManagerBalance("MANAGER_1", "DEEP");
        const sui = await this.client.checkManagerBalance("MANAGER_1", "SUI");
        const dbusdc = await this.client.checkManagerBalance("MANAGER_1", "DBUSDC");
        const dbusdt = await this.client.checkManagerBalance("MANAGER_1", "DBUSDT");

        console.log("DEEP: ", deep);
        console.log("SUI: ", sui);
        console.log("DBUSDC: ", dbusdc);
        console.log("DBUSDT: ", dbusdt);
    }

    depositCoins = async (
        sui: number,
        deep: number,
        dbusdc: number,
        dbusdt: number,
    ) => {
        const tx = new Transaction();
        tx.add(
            this.client.balanceManager.depositIntoManager("MANAGER_1", "DEEP", deep),
        );
        tx.add(
            this.client.balanceManager.depositIntoManager("MANAGER_1", "SUI", sui),
        );
        tx.add(
            this.client.balanceManager.depositIntoManager("MANAGER_1", "DBUSDC", dbusdc),
        );
        tx.add(
            this.client.balanceManager.depositIntoManager("MANAGER_1", "DBUSDT", dbusdt),
        );

        return this.signAndExecute(tx);
    }

    withdrawCoins = async () => {
        const tx = new Transaction();
        tx.add(
            this.client.balanceManager.withdrawAllFromManager("MANAGER_1", "DEEP", this.keypair.toSuiAddress()),
        );
        tx.add(
            this.client.balanceManager.withdrawAllFromManager("MANAGER_1", "SUI", this.keypair.toSuiAddress()),
        );
        tx.add(
            this.client.balanceManager.withdrawAllFromManager("MANAGER_1", "DBUSDC", this.keypair.toSuiAddress()),
        );
        tx.add(
            this.client.balanceManager.withdrawAllFromManager("MANAGER_1", "DBUSDT", this.keypair.toSuiAddress()),
        );

        return this.signAndExecute(tx);
    }

    createAndShareBM = async () => {
        const tx = new Transaction();
        tx.add(
            this.client.balanceManager.createAndShareBalanceManager(),
        );
        return this.signAndExecute(tx);
    }

    getSignerFromPK = (privateKey: string) => {
        const { schema, secretKey } = decodeSuiPrivateKey(privateKey);
        if (schema === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

        throw new Error(`Unsupported schema: ${schema}`);
    };

    signAndExecute = async (tx: Transaction) => {
        tx.setGasBudget(5000000000);
        return this.client.client.signAndExecuteTransaction({
            transaction: tx,
            signer: this.keypair,
            options: {
                showEffects: true,
                showObjectChanges: true,
            },
        });
    };
}
