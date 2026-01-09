import Head from 'next/head';
import MessageBoard from "../components/MessageBoard";

export default function Home() {
  return (
    <>
      <Head>
        <title>Base Message Board</title>
        <meta name="description" content="Decentralized message board on Base Network" />
        
        {/* Стандарт Farcaster Frames */}
        <meta property="fc:frame" content="vNext" />
        {/* ИСПОЛЬЗУЕМ ТВОЮ ИКОНКУ И ТВОЙ ДОМЕН */}
        <meta property="fc:frame:image" content="https://base-message-board-app.vercel.app/icon.png" />
        <meta property="fc:frame:button:1" content="Post Message" />
        
        {/* Open Graph (для красивых ссылок в Telegram/Twitter) */}
        <meta property="og:title" content="Base Message Board" />
        <meta property="og:description" content="Leave your mark on the Base blockchain forever." />
        <meta property="og:image" content="https://base-message-board-app.vercel.app/icon.png" />
      </Head>
      <MessageBoard />
    </>
  );
}
