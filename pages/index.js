import Head from 'next/head'; // 1. Обязательно добавьте этот импорт в самом верху

export default function Home() {
  
  // Это ссылка на ваш сайт
  const appUrl = 'https://base-message-board-app.vercel.app';
  
  // Это конфигурация фрейма (Farcaster Frame v2)
  const frameMetadata = JSON.stringify({
    version: "next",
    imageUrl: `${appUrl}/icon.png`, // Картинка из папки public
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <Head>
        {/* 2. Вот эти теги нужны для Farcaster: */}
        <title>Base Message Board</title>
        <meta name="description" content="My Farcaster Mini App" />
        
        {/* Главный тег для Mini App */}
        <meta name="fc:frame" content={frameMetadata} />
        
        {/* Дополнительные теги для красоты (Open Graph) */}
        <meta property="og:title" content="Base Message Board" />
        <meta property="og:image" content={`${appUrl}/icon.png`} />
      </Head>

      <main>
        <h1>Welcome to my Farcaster App</h1>
        <p>Если вы видите этот текст, значит сайт работает.</p>
      </main>
    </div>
  );
}
