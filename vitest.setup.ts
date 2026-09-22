// Pin the test environment to UTC so Date parsing and formatting are
// deterministic regardless of the host machine's local timezone.
process.env.TZ = 'UTC';
