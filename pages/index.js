import Head from 'next/head';
import MessageBoard from "../components/MessageBoard";

export default function Home() {
  
  // Настройки для Farcaster (чтобы работала кнопка Launch)
  const appUrl = 'https://base-message-board-app.vercel.app';
  
  const frameMetadata = JSON.stringify({
    version: "next",
    imageUrl: `${appUrl}/icon.png`,
    button: {
      title: "Launch App",
      action: {
        type: "launch_frame",
        name: "Message Board",
        url: appUrl,
        splashImageUrl: `${appUrl}/icon.png`,
        splashBackgroundColor: "#ffffff"
      }
    }
  });

  return (
    <>
      <Head>
        <title>Base Message Board</title>
        <meta name="description" content="Decentralized message board on Base Network" />
        
        {/* Главная настройка для Mini App */}
        <meta name="fc:frame" content={frameMetadata} />
        
        {/* Open Graph (для красивых ссылок в Telegram/Twitter) */}
        <meta property="og:title" content="Base Message Board" />
        <meta property="og:description" content="Leave your mark on the Base blockchain forever." />
        <meta property="og:image" content={`${appUrl}/icon.png`} />
      </Head>

      {/* Сам компонент приложения с сообщениями */}
      <MessageBoard />
    </>
  );
}
