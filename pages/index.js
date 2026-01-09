import Head from 'next/head';
import MessageBoard from "../components/MessageBoard";

export default function Home() {
  return (
    <>
      <Head>
        <title>Base Message Board</title>
        <meta name="description" content="Decentralized message board on Base Network" />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://base.org/document/og-image.png" />
        <meta property="og:title" content="Base Message Board" />
        <meta property="og:description" content="Leave your mark on the Base blockchain forever." />
      </Head>
      <MessageBoard />
    </>
  );
}
