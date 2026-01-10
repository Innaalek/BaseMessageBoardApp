import { sdk } from "@farcaster/frame-sdk";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

// ID сети Base Mainnet
const BASE_CHAIN_ID = "0x2105"; // 8453 в HEX
const BASE_CHAIN_ID_DECIMAL = 8453;

const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessages() external view returns (tuple(address user, string text, uint256 timestamp)[])",
  "event MessagePosted(address indexed user, string text, uint256 timestamp)"
];

export default function MessageBoard() {
  const [contractInstance, setContractInstance] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [text, setText] = useState("");
  const [messagesList, setMessagesList] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (sdk && sdk.actions) await sdk.actions.ready();
      } catch (e) { console.error(e); }
    };
    init();
  }, []);

  const getEthProvider = () => {
    if (typeof window !== "undefined" && window.ethereum) return window.ethereum;
    if (sdk?.wallet?.ethProvider) return sdk.wallet.ethProvider;
    return null;
  };

  // --- НОВАЯ ФУНКЦИЯ: ПРОВЕРКА СЕТИ ---
  async function checkAndSwitchNetwork(provider) {
    try {
      const network = await provider.getNetwork();
      console.log("Current Chain ID:", network.chainId);

      // Если мы не на Base (8453)
      if (network.chainId !== BigInt(BASE_CHAIN_ID_DECIMAL)) {
        try {
          // Просим переключиться
          await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID }]);
        } catch (switchError) {
          // Если сети нет, добавляем её (код 4902)
          if (switchError.code === 4902 || switchError.error?.code === 4902) {
            await provider.send("wallet_addEthereumChain", [{
              chainId: BASE_CHAIN_ID,
              chainName: "Base Mainnet",
              rpcUrls: ["https://mainnet.base.org"],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: ["https://basescan.org"]
            }]);
          } else {
            throw switchError;
          }
        }
      }
    } catch (error) {
      console.error("Network switch error:", error);
      alert("Error switching network: " + error.message);
      throw error; // Прерываем выполнение, если не переключились
    }
  }

  async function connectWallet() {
    const ethProvider = getEthProvider();
    if (!ethProvider) {
      alert("No wallet found.");
      return;
    }

    try {
      const _provider = new ethers.BrowserProvider(ethProvider);
      
      // 1. Сначала проверяем сеть!
      await checkAndSwitchNetwork(_provider);

      await _provider.send("eth_requestAccounts", []);
      const signer = await _provider.getSigner();
      const address = await signer.getAddress();
      
      setUserAddress(address);
      const contract = new ethers.Contract(contractAddress, abi, signer);
      setContractInstance(contract);
      
      loadMessages(_provider);
      
    } catch (error) {
      console.error(error);
      alert("Connection failed: " + error.message);
    }
  }

  async function loadMessages(currentProvider) {
    try {
      let providerToUse = currentProvider;
      if (!providerToUse) {
          const ethP = getEthProvider();
          if (ethP) providerToUse = new ethers.BrowserProvider(ethP);
      }
      if (!providerToUse) return;

      const readContract = new ethers.Contract(contractAddress, abi, providerToUse);
      const rawMessages = await readContract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse();

      setMessagesList(items);
      setIsLoaded(true);
    } catch (error) { console.error(error); }
  }

  async function handlePublish() {
    // Если еще не подключены - подключаемся (это вызовет проверку сети)
    if (!contractInstance) {
      await connectWallet();
      return;
    }

    if (!text.trim()) return;

    try {
      setIsSending(true);
      
      // Еще раз проверяем провайдер перед отправкой
      if (contractInstance.runner && contractInstance.runner.provider) {
         await checkAndSwitchNetwork(contractInstance.runner.provider);
      }

      const fee = ethers.parseEther("0.000001"); 
      
      // Отправляем с жестким лимитом газа
      const tx = await contractInstance.postMessage(text, { 
        value: fee,
        gasLimit: 500000 // Увеличил лимит до 500k для надежности
      });
      
      // Мгновенное обновление UI (Optimistic UI)
      const newMessage = {
        from: userAddress,
        text: text,
        time: "Just now (Pending...)"
      };
      setMessagesList([newMessage, ...messagesList]);
      setText("");

      await tx.wait();
      
      alert("Success! Message on blockchain.");
      setIsSending(false);
      
      // Фоновое обновление
      const ethProvider = getEthProvider();
      if(ethProvider) loadMessages(new ethers.BrowserProvider(ethProvider));

    } catch (err) {
      setIsSending(false);
      console.error(err);
      alert("Error: " + (err.shortMessage || err.message));
    }
  }

  useEffect(() => {
    setTimeout(() => loadMessages(null), 500);
  }, []);

  return (
    <div style={{ padding: 20, maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{textAlign: "center"}}>Base Message Board</h1>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{
                padding: "12px 24px", backgroundColor: "#0052FF", color: "white", 
                border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", cursor: "pointer"
            }}>
             Connect Wallet
          </button>
        ) : (
          <div style={{padding: "10px", background: "#e6f2ff", borderRadius: "8px", display: "inline-block", color: "#0052FF"}}>
            <span style={{fontWeight: "bold"}}>Connected: </span> 
            {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
        )}
      </div>

      <div style={{display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message on Base..."
            rows={4}
            disabled={isSending}
            style={{
                padding: 12, borderRadius: "8px", border: "1px solid #ccc", 
                fontSize: "16px", width: "100%", boxSizing: "border-box", fontFamily: "inherit"
            }}
        />
        <button 
            onClick={handlePublish} 
            disabled={!text.trim() || isSending}
            style={{
                padding: "12px", 
                backgroundColor: (text.trim() && !isSending) ? "#333" : "#ccc", 
                color: "white", border: "none", borderRadius: "8px",
                cursor: (text.trim() && !isSending) ? "pointer" : "not-allowed",
                fontSize: "16px", fontWeight: "bold"
            }}>
            {isSending ? "Publishing..." : "Publish (Cost: 0.000001 ETH)"}
        </button>
      </div>

      <h2 style={{borderBottom: "2px solid #eee", paddingBottom: "10px"}}>On-chain messages:</h2>
      {messagesList.length === 0 && <p style={{textAlign: "center", color: "#888"}}>Loading messages...</p>}
      {messagesList.map((m, i) => (
        <div key={i} style={{ 
            border: "1px solid #eee", padding: "15px", marginBottom: "10px", 
            borderRadius: "12px", backgroundColor: "#fafafa"
        }}>
          <p style={{fontWeight: "500", fontSize: "1.1em", margin: "0 0 8px 0", wordWrap: "break-word"}}>{m.text}</p>
          <div style={{display: "flex", justifyContent: "space-between", fontSize: "0.85em", color: "#666"}}>
            <span>From: <span style={{color: "#0052FF"}}>{m.from.slice(0, 6)}...{m.from.slice(-4)}</span></span>
            <span>{m.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
