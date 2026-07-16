# In-Memory Chaos Log Rolling Policy

Details on circular log array management in chaos controller:
- Max log buffer size: `100` elements.
- Array elements are popped from index 0 on overflow (`CHAOS_LOG.pop(0)`) to maintain memory usage bounds.
