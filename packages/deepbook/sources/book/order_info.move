// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Order module defines the order struct and its methods.
/// All order matching happens in this module.
module deepbook::order_info {
    use sui::event;
    use deepbook::{math, utils};

    const MIN_PRICE: u64 = 1;
    const MAX_PRICE: u64 = (1u128 << 63 - 1) as u64;

    // Restrictions on limit orders.
    const NO_RESTRICTION: u8 = 0;
    // Mandates that whatever amount of an order that can be executed in the current transaction, be filled and then the rest of the order canceled.
    const IMMEDIATE_OR_CANCEL: u8 = 1;
    // Mandates that the entire order size be filled in the current transaction. Otherwise, the order is canceled.
    const FILL_OR_KILL: u8 = 2;
    // Mandates that the entire order be passive. Otherwise, cancel the order.
    const POST_ONLY: u8 = 3;
    // Maximum restriction value.
    const MAX_RESTRICTION: u8 = 3;

    const LIVE: u8 = 0;
    const PARTIALLY_FILLED: u8 = 1;
    const FILLED: u8 = 2;
    const CANCELED: u8 = 3;
    const EXPIRED: u8 = 4;

    const EOrderInvalidPrice: u64 = 0;
    const EOrderBelowMinimumSize: u64 = 1;
    const EOrderInvalidLotSize: u64 = 2;
    const EInvalidExpireTimestamp: u64 = 3;
    const EInvalidOrderType: u64 = 4;
    const EPOSTOrderCrossesOrderbook: u64 = 5;
    const EFOKOrderCannotBeFullyFilled: u64 = 6;
    const EInvalidNewQuantity: u64 = 7;
    const EOrderExpired: u64 = 8;

    /// OrderInfo struct represents all order information.
    /// This objects gets created at the beginning of the order lifecycle and
    /// gets updated until it is completed or placed in the book.
    /// It is returned to the user at the end of the order lifecycle.
    public struct OrderInfo has store, drop {
        // ID of the pool
        pool_id: ID,
        // ID of the order within the pool
        order_id: u128,
        // ID of the order defined by client
        client_order_id: u64,
        // Owner of the order
        owner: address,
        // Order type, NO_RESTRICTION, IMMEDIATE_OR_CANCEL, FILL_OR_KILL, POST_ONLY
        order_type: u8,
        // Price, only used for limit orders
        price: u64,
        // Whether the order is a buy or a sell
        is_bid: bool,
        // Quantity (in base asset terms) when the order is placed
        original_quantity: u64,
        // Expiration timestamp in ms
        expire_timestamp: u64,
        // Quantity executed so far
        executed_quantity: u64,
        // Cumulative quote quantity executed so far
        cumulative_quote_quantity: u64,
        // Any partial fills
        fills: vector<Fill>,
        // Whether the fee is in DEEP terms
        fee_is_deep: bool,
        // Fees paid so far in base/quote/DEEP terms
        paid_fees: u64,
        // Maker fee when injecting order
        maker_fee: u64,
        // Status of the order
        status: u8,
        // Reserved field for prevent self_matching
        self_matching_prevention: bool,
    }

    /// Emitted when a maker order is filled.
    public struct OrderFilled has copy, store, drop {
        pool_id: ID,
        maker_order_id: u128,
        taker_order_id: u128,
        maker_client_order_id: u64,
        taker_client_order_id: u64,
        price: u64,
        is_bid: bool,
        base_quantity: u64,
        quote_quantity: u64,
        maker_address: address,
        taker_address: address,
        timestamp: u64,
    }

    /// Emitted when a maker order is canceled.
    public struct OrderCanceled<phantom BaseAsset, phantom QuoteAsset> has copy, store, drop {
        pool_id: ID,
        order_id: u128,
        client_order_id: u64,
        owner: address,
        price: u64,
        is_bid: bool,
        base_asset_quantity_canceled: u64,
        timestamp: u64,
    }

    /// Emitted when a maker order is modified.
    public struct OrderModified<phantom BaseAsset, phantom QuoteAsset> has copy, store, drop {
        pool_id: ID,
        order_id: u128,
        client_order_id: u64,
        owner: address,
        price: u64,
        is_bid: bool,
        new_quantity: u64,
        timestamp: u64,
    }

    /// Emitted when a maker order is injected into the order book.
    public struct OrderPlaced has copy, store, drop {
        pool_id: ID,
        order_id: u128,
        client_order_id: u64,
        owner: address,
        price: u64,
        is_bid: bool,
        original_quantity: u64,
        executed_quantity: u64,
        expire_timestamp: u64,
    }

    /// Fill struct represents the results of a match between two orders.
    /// It is used to update the state.
    public struct Fill has store, drop, copy {
        // ID of the maker order
        order_id: u128,
        // Owner of the maker order
        owner: address,
        // Whether the maker order is expired
        expired: bool,
        // Whether the maker order is fully filled
        complete: bool,
        // Quantity settled in base asset terms for maker
        settled_base: u64,
        // Quantity settled in quote asset terms for maker
        settled_quote: u64,
        // Quantity settled in DEEP for maker
        settled_deep: u64,
    }

    public(package) fun initial_order(
        pool_id: ID,
        client_order_id: u64,
        owner: address,
        order_type: u8,
        price: u64,
        quantity: u64,
        is_bid: bool,
        expire_timestamp: u64,
        maker_fee: u64,
    ): OrderInfo {
        OrderInfo {
            pool_id,
            order_id: 0,
            client_order_id,
            owner,
            order_type,
            price,
            is_bid,
            original_quantity: quantity,
            expire_timestamp,
            executed_quantity: 0,
            cumulative_quote_quantity: 0,
            fills: vector[],
            fee_is_deep: false,
            paid_fees: 0,
            maker_fee,
            status: LIVE,
            self_matching_prevention: false,
        }
    }

    public fun pool_id(self: &OrderInfo): ID {
        self.pool_id
    }

    public fun order_id(self: &OrderInfo): u128 {
        self.order_id
    }

    public fun client_order_id(self: &OrderInfo): u64 {
        self.client_order_id
    }

    public fun owner(self: &OrderInfo): address {
        self.owner
    }

    public fun order_type(self: &OrderInfo): u8 {
        self.order_type
    }

    public fun price(self: &OrderInfo): u64 {
        self.price
    }

    public fun is_bid(self: &OrderInfo): bool{
        self.is_bid
    }

    public fun original_quantity(self: &OrderInfo): u64 {
        self.original_quantity
    }

    public fun executed_quantity(self: &OrderInfo): u64 {
        self.executed_quantity
    }

    public fun cumulative_quote_quantity(self: &OrderInfo): u64 {
        self.cumulative_quote_quantity
    }

    public fun paid_fees(self: &OrderInfo): u64 {
        self.paid_fees
    }

    public fun maker_fee(self: &OrderInfo): u64 {
        self.maker_fee
    }

    public fun fee_is_deep(self: &OrderInfo): bool {
        self.fee_is_deep
    }

    public fun status(self: &OrderInfo): u8 {
        self.status
    }

    public fun expire_timestamp(self: &OrderInfo): u64 {
        self.expire_timestamp
    }

    public fun self_matching_prevention(self: &OrderInfo): bool {
        self.self_matching_prevention
    }

    public fun fills(self: &OrderInfo): vector<Fill> {
        self.fills
    }

    public(package) fun last_fill(self: &OrderInfo): &Fill {
        &self.fills[self.fills.length() - 1]
    }

    public(package) fun set_order_id(self: &mut OrderInfo, order_id: u128) {
        self.order_id = order_id;
    }

    /// Validates that the initial order created meets the pool requirements.
    public(package) fun validate_inputs(
        order_info: &OrderInfo,
        tick_size: u64,
        min_size: u64,
        lot_size: u64,
        timestamp: u64,
    ) {
        assert!(order_info.price >= MIN_PRICE && order_info.price <= MAX_PRICE, EOrderInvalidPrice);
        assert!(order_info.price % tick_size == 0, EOrderInvalidPrice);
        assert!(order_info.original_quantity >= min_size, EOrderBelowMinimumSize);
        assert!(order_info.original_quantity % lot_size == 0, EOrderInvalidLotSize);
        assert!(order_info.expire_timestamp >= timestamp, EInvalidExpireTimestamp);
        assert!(order_info.order_type >= NO_RESTRICTION && order_info.order_type <= MAX_RESTRICTION, EInvalidOrderType);
    }

    /// Returns the remaining quantity for the order.
    public(package) fun remaining_quantity(self: &OrderInfo): u64 {
        self.original_quantity - self.executed_quantity
    }

    /// Asserts that the order doesn't have any fills.
    public(package) fun assert_post_only(self: &OrderInfo) {
        if (self.order_type == POST_ONLY)
            assert!(self.executed_quantity == 0, EPOSTOrderCrossesOrderbook);
    }

    /// Asserts that the order is fully filled.
    public(package) fun assert_fill_or_kill(self: &OrderInfo) {
        if (self.order_type == FILL_OR_KILL)
            assert!(self.executed_quantity == self.original_quantity, EFOKOrderCannotBeFullyFilled);
    }

    /// Checks whether this is an immediate or cancel type of order.
    public(package) fun is_immediate_or_cancel(self: &OrderInfo): bool {
        self.order_type == IMMEDIATE_OR_CANCEL
    }

    /// Returns the fill or kill constant.
    public(package) fun fill_or_kill(): u8 {
        FILL_OR_KILL
    }

    /// Returns the result of the fill and the maker id & owner.
    public(package) fun fill_status(fill: &Fill): (u128, address, bool, bool) {
        (fill.order_id, fill.owner, fill.expired, fill.complete)
    }

    /// Returns the settled quantities for the fill.
    public(package) fun settled_quantities(fill: &Fill): (u64, u64, u64) {
        (fill.settled_base, fill.settled_quote, fill.settled_deep)
    }

    fun emit_order_filled(self: &OrderInfo, timestamp: u64) {
        event::emit(OrderFilled {
            pool_id: self.pool_id,
            maker_order_id: self.order_id,
            taker_order_id: self.order_id,
            maker_client_order_id: self.client_order_id,
            taker_client_order_id: self.client_order_id,
            base_quantity: self.original_quantity,
            quote_quantity: self.original_quantity * self.price,
            price: self.price,
            maker_address: self.owner,
            taker_address: self.owner,
            is_bid: self.is_bid,
            timestamp,
        });
    }

    public(package) fun emit_order_placed(self: &OrderInfo) {
        event::emit(OrderPlaced {
            pool_id: self.pool_id,
            order_id: self.order_id,
            client_order_id: self.client_order_id,
            is_bid: self.is_bid,
            owner: self.owner,
            original_quantity: self.original_quantity,
            executed_quantity: self.executed_quantity,
            price: self.price,
            expire_timestamp: self.expire_timestamp,
        });
    }
}
