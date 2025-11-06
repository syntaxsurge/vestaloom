# Vestaloom Demo Script

Follow these steps to record the 3–5 minute demo video required by both hackathons.

## 1. Setup (30 seconds)

1. Share the Somnia explorer tabs for `VestaQuest` and `VestaBadge`.
2. Open http://localhost:3000/somnia in another tab.
3. Ensure your wallet is connected to Somnia Shannon (chain ID 50312).

## 2. Quest Submission (90 seconds)

1. On `/somnia`, enter a quest ID (e.g. `101`) and a proof URI (GitHub gist, IPFS CID, etc.).
2. Click **Submit quest**. Narrate the on-chain transaction and confirm it in your wallet.
3. After the toast confirms success, highlight the API call that writes to Somnia Data Streams.

## 3. Real-time Feed (45 seconds)

1. Scroll to the “Live quest feed” panel.
2. Point out the new entry and note that it arrived without a page refresh because the SDS hook polls the shared schema.
3. Open the Somnia explorer and show the corresponding `QuestCompleted` event.

## 4. Kwala Automation (60 seconds)

1. Switch to the Kwala dashboard (or CLI) and show the workflow execution triggered by the event.
2. Demonstrate the badge mint by refreshing the `VestaBadge` contract page (the `nextTokenId` counter increases).
3. Mention that the YAML lives in `kwala/vestaloom-quest.yaml` and requires no custom server.

## 5. Wrap-up (30 seconds)

1. Summarize how a single deployment satisfies both hackathon tracks.
2. Provide the GitHub repository URL and remind judges of the README sections detailing setup.

That’s it—trim or extend each segment to fit the 3–5 minute requirement.
