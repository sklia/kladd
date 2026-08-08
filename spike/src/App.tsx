import { Editor } from "./Editor.tsx";
import sample from "./sample.md?raw";

export default function App() {
  return <Editor initialDoc={sample} />;
}
