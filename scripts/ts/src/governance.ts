import { TransactionBlock } from "@mysten/sui.js/transactions";
import { signAndExecute } from "./utils";
import {
    ENV, DEEPBOOK_PACKAGE_ID, Pools, Pool, Constants, MANAGER_ID
} from './coinConstants';

// =================================================================
// Transactions
// =================================================================

const stake = async (
    pool: Pool,
    stakeAmount: number,
    txb: TransactionBlock,
) => {
    txb.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::stake`,
        arguments: [
            txb.object(pool.poolAddress),
            txb.object(MANAGER_ID),
            txb.pure.u64(stakeAmount * pool.baseCoin.scalar),
        ],
        typeArguments: [pool.baseCoin.type, pool.quoteCoin.type]
    });
}

const unstake = async (
    pool: Pool,
    txb: TransactionBlock,
) => {
    txb.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::unstake`,
        arguments: [
            txb.object(pool.poolAddress),
            txb.object(MANAGER_ID),
        ],
        typeArguments: [pool.baseCoin.type, pool.quoteCoin.type]
    });
}

const submitProposal = async (
    pool: Pool,
    takerFee: number,
    makerFee: number,
    stakeRequired: number,
    txb: TransactionBlock,
) => {
    txb.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::submit_proposal`,
        arguments: [
            txb.object(pool.poolAddress),
            txb.object(MANAGER_ID),
            txb.pure.u64(takerFee * Constants.FLOAT_SCALAR),
            txb.pure.u64(makerFee * Constants.FLOAT_SCALAR),
            txb.pure.u64(stakeRequired * pool.baseCoin.scalar),
        ],
        typeArguments: [pool.baseCoin.type, pool.quoteCoin.type]
    });
}

const vote = async (
    pool: Pool,
    proposal_id: string,
    txb: TransactionBlock,
) => {
    txb.moveCall({
        target: `${DEEPBOOK_PACKAGE_ID}::pool::vote`,
        arguments: [
            txb.object(pool.poolAddress),
            txb.object(MANAGER_ID),
            txb.pure.id(proposal_id),
        ],
    });
}

/// Main entry points, comment out as needed...
const executeTransaction = async () => {
    const txb = new TransactionBlock();

    // await stake(Pools.TONY_SUI_POOL, 100, txb);
    // await unstake(Pools.DEEP_SUI_POOL, txb);
    // await submitProposal(Pools.TONY_SUI_POOL, 0.0005, 0.0002, 10, txb);
    // await vote(Pools.TONY_SUI_POOL, 'proposal_id', txb);

    // Run transaction against ENV
    const res = await signAndExecute(txb, ENV);

    console.dir(res, { depth: null });
}

executeTransaction();
