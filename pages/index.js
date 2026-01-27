import Head from 'next/head';
import { useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';
import MessageBoard from "../components/MessageBoard";

export default function Home() {
  
  // 1. Сообщаем Farcaster, что приложение загрузилось
  useEffect(() => {
    const load = async () => {
      await sdk.actions.ready();
    };
    if (sdk && sdk.actions) {
      load();
    }
  }, []);

  // 2. Настройки для кнопки Launch
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
        
        {/* ВОТ ЭТУ СТРОКУ МЫ ДОБАВИЛИ ДЛЯ ВЕРИФИКАЦИИ: */}
        <meta name="base:app_id" content="6977e03888e3bac59cf3da4f" />
        
        <meta name="fc:frame" content={frameMetadata} />
        <meta property="og:title" content="Base Message Board" />
        <meta property="og:image" content={`${appUrl}/icon.png`} />
      </Head>

      <MessageBoard />
    </>
  );
}
