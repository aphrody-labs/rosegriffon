# QA, Obscura, agent-browser, and sandboxed shell recipes.

[group('qa')]
[doc("Run Obscura health and site check against rosegriffon.fr.")]
obscura-health url="https://rosegriffon.fr":
    obscura check {{url}}

[group('qa')]
[doc("Run automated browser QA checks via agent-browser.")]
agent-browser-qa url="https://rosegriffon.fr":
    agent-browser open {{url}}
    agent-browser snapshot -i

[group('qa')]
[doc("Run an isolated sandboxed bash command or interactive shell via just-bash.")]
sandbox-sh *args:
    just-bash {{args}}
