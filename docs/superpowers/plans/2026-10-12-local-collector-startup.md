# Local collector startup correction

User clarified that starting the website must start data collection immediately even without Supabase credentials. Add an atomic local snapshot store as the default when no cloud credentials are present. Keep Supabase as an available storage selection and keep community storage unchanged.

- [x] Verify failing tests for missing-credential startup, durable cross-process reads, failure retention and safe file keys.
- [x] Implement local files with atomic replacement, actual collection timestamps and last-attempt failure state; choose local storage when Supabase is absent.
- [x] Make the standard development launcher always start the collector and bind to the existing 127.0.0.1:5173 entry; remove production's unnecessary credential gate.
- [x] Update deployment/configuration instructions; verify all tests and build.
- [x] Restart the actual website and collector, confirm real upstream data is saved and advances across a collection interval without page visits.

Actual startup saved all 25 production datasets without Supabase. Network saved at 12:13:39 UTC and advanced across subsequent 30-second cycles; the independent file reader and real website display current stored data. A production-key regression exposed and fixed underscore rejection. Build passed, full test suite passed (154 tests). Local storage remains a single-collector mode and the snapshot directory must persist across cloud deployments.
