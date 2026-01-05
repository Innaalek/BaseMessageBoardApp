import { useState } from "https://esm.sh/react@18.2.0";
import { ethers } from "https://esm.sh/ethers@6.7.1";

const contractAddress = "0x7cb7f14331DCAdefbDf9dd3AAeb596a305cbA3D2";

const abi = [
  "event MessagePosted(address indexed user, string text, uint256 timestamp)",
  "function postMessage(string calldata text) payable",
  "function messages(uint256) view returns (address user, string text, uint256 timestamp)",
  "function getMessagesCount() view returns (uint256)"
];

export default function MessageBoard() {
  const [contract, setContract] = useState(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  async function connect() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const c = new ethers.Contract(contractAddress, abi, signer);
    setContract(c);
    load(c);
  }

  async function load(c) {
    const count = await c.getMessagesCount();
    const list = [];
    for (let i = 0; i < count; i++) {
      const m = await c.messages(i);
      list.push(m);
    }
    setMessages(list.reverse());
  }

  async function publish() {
    const tx = await contract.postMessage(text, {
      value: ethers.parseEther("0.000005")
    });
    await tx.wait();
    setText("");
    load(contract);
  }

  return (
    React.createElement("div", {},
      React.createElement("button", { onClick: connect }, "Connect Wallet"),
      React.createElement("br"),
      React.createElement("textarea", {
        value: text,
        onChange: e => setText(e.target.value)
      }),
      React.createElement("button", { onClick: publish }, "Publish"),
      messages.map((m, i) =>
        React.createElement("div", { key: i },
          m.user.slice(0,6), ": ", m.text
        )
      )
    )
  );
}
