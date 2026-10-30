# The Music Box: a Telegram Mini App gift

A wind-up music box made with three.js. When you wind the heart-shaped key, the lid lifts and
a small story plays on the turning stage, timed to *The Piano Duet*. There's no text anywhere.

## The story (in song time)

| time | what happens |
|---|---|
| wind-up | A closed porcelain music box on a table. Drag in a circle to turn the heart key on its side: it clicks, chimes and gives haptic taps, and a gold ring on the lid fills. Let go and it plays. |
| 0:00 | The lid swings open on its hinge and becomes a painted sky that changes with the story. Through the little front window, the brass cylinder turns and the comb's teeth are plucked on each note. She is a nurse in the children's ward, with a tiny rain cloud over her head. At each bed a child wakes up and a balloon appears. |
| 0:18 | In the silence the ward folds away and the children sleep. |
| 0:19 | Rainy street. She walks alone, hugging herself, sits on a bench under a lamp and wipes a tear. |
| 0:42 | He arrives, sits beside her, then stands up and ties a string to her rain cloud. |
| 0:53 | In the silence he gives her the string. |
| 0:55 | When the duet comes back in, the cloud turns into a red heart balloon. The sun comes up, her scrubs become a dress, and flowers bloom on the notes. |
| 1:06 | His mountains (with the fence from his photo), golden hour, his arm around her. |
| 1:17 | Dusk. Fairy lights switch on with the notes. They dance, waltz to the centre, and float during the climax. |
| 1:47 | In the silence he loops the balloon string around both their joined hands, the string turns red, and they rest their foreheads together. |
| 1:52 | Veil, flower crown, an arch, petals falling where the rain used to be. A little girl with her mother's black hair runs to them and takes the heart balloon. A little house lights up. |
| 2:03 | The three walk through the arch towards home. They look back, and the girl waves. |
| 2:10 | The key slows to a stop, everything folds back into the stage, the lid closes, and the heart on top beats twice. You can wind it again. |

During the story you can drag sideways to look around, tap the stage for hearts and a chime,
or tap either figure to make them hop.

## Run locally

```bash
npm install
npm run dev
```

To jump to a moment, open `http://localhost:5174/?t=55`, then tap once to start there.

## Live site

`https://alephhnull.github.io/tiny-duet/`. Every push to `main` rebuilds and redeploys it through
GitHub Actions (`.github/workflows/deploy.yml`).

## Put it on Telegram

1. In **@BotFather**, send `/newbot`, then pick a name and a username (the username must end in `bot`).
2. `/mybots`, choose your bot, then **Bot Settings, Configure Mini App, Enable Mini App**, and send
   `https://alephhnull.github.io/tiny-duet/`.
3. Optional: `/setuserpic` with `bot-photo.png` (one folder up from this file). Also `/setdescription` and
   `/setabouttext` with just an emoji such as 🎶, so there's no text to read.
4. Store the bot token as a repository secret. It asks for the token without showing it:

   ```bash
   gh secret set BOT_TOKEN --repo alephhNull/tiny-duet
   ```

5. Open your bot in Telegram and press **Start**.
6. Send yourself the gift message:

   ```bash
   gh workflow run send-gift.yml --repo alephhNull/tiny-duet
   ```

   The bot sends you a photo of the closed music box with one 🎁 button, and sets the chat's menu
   button to 🎁 too. To use a different emoji, add `-f button=💌`.
7. Forward that photo to her. Tapping 🎁 opens the music box inside Telegram, full screen on phones.

### Before you send it

- Test it on your own phone first, with the sound on. It's built so the song should play even when an
  iPhone is on silent, but check that on a real phone before you send it.
- The repository is public and the song is a commercial recording, so don't share the link around.
