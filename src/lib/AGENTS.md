# src/lib notes
- Variations come only from product-scoped data or explicit labels (multi-voltage titles give a Voltagem tier); each starts at programmed stock ±1,000.
- Variations live in the listing JSON; persist the item ID before model init, never delete remote combinations (update name-matched models), recreate deleted items, and link duplicates to the existing shop item.
- Shopee order synchronization splits its history into windows shorter than 15 days, resets pagination per window and deduplicates boundary orders; this meets the provider time-range constraint without dropping history.
