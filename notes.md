1. Error: Browser loads cached old JSON model instead of new DSL model. (Example: "remove last 10 sec" -> "Muted Section: None")
2. Error: Model echoes prompt text because input is out-of-distribution. (Example: "cut last 1 min" -> "You are Hornet.")
3. Error: Frontend system prompt and context headers don't match training data. (Example: [RECENT EDITS] vs [RECENT ACTIONS])
4. Error: Supabase logging fails due to unresolvable domain. (Example: net::ERR_NAME_NOT_RESOLVED on ai_logs)
