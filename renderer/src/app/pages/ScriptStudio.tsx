git commit -m "Added advanced scripting engine"git commit -m "Added advanced scripting engin// I got Tortured in this one
// Please like and subscirbe for this one gng

import React, { useEffect, useRef, useState } from "react"
import type * as monacoNS from "monaco-editor"

const DEFAULT_CODE = `print("We be changing theme frfr")
// This Makes it Wait 1 Second
// 1000 = 1 second
// Counted as milliseconds
// Next JSD (JavaScript Direct) update will change
// 1 = 1 second


// Oh Wait I Just Realised The Thing just ignores the wait statement
// oh well i'll fix it next update
wait(1000)

launcherAPI.setGlobalStyle({
  background: "#0a0a12",
  fontSize: "18px",
  accent: "#7c3aed"
})

print("Shitty Looking Purple Mode Activated")
`

type GlobalStyle = {
  background?: string
  fontFamily?: string
  fontSize?: string
  accent?: string
}

export default function ScriptStudio(): JSX.Element {

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const monacoInstanceRef = useRef<monacoNS.editor.IStandaloneCodeEditor | null>(null)

  const [useMonaco, setUseMonaco] = useState(false)
  const [output, setOutput] = useState<string[]>([])

  useEffect(() => {
    let mounted = true

    async function loadMonaco() {
      try {
        const monaco = (await import("monaco-editor")) as typeof monacoNS
        if (!mounted) return
        setUseMonaco(true)

        if (editorRef.current && !monacoInstanceRef.current) {
          monacoInstanceRef.current = monaco.editor.create(editorRef.current, {
            value: DEFAULT_CODE,
            language: "javascript",
            theme: "vs-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14
          })
        }
      } catch {
        setUseMonaco(false)
      }
    }

    loadMonaco()

    return () => {
      mounted = false
      monacoInstanceRef.current?.dispose()
    }
  }, [])

  function applyGlobalStyle(style: GlobalStyle) {
    const appRoot = document.getElementById("root")

    if (style.background) {
      document.body.style.background = style.background
      if (appRoot) appRoot.style.background = style.background
    }

    if (style.fontFamily) {
      document.body.style.fontFamily = style.fontFamily
      if (appRoot) appRoot.style.fontFamily = style.fontFamily
    }

    if (style.fontSize) {
      document.body.style.fontSize = style.fontSize
      if (appRoot) appRoot.style.fontSize = style.fontSize
    }

    if (style.accent) {
      let styleEl = document.getElementById("uc-accent-style") as HTMLStyleElement | null
      if (!styleEl) {
        styleEl = document.createElement("style")
        styleEl.id = "uc-accent-style"
        document.head.appendChild(styleEl)
      }

      styleEl.innerHTML = `
        button {
          background: linear-gradient(135deg, ${style.accent}, #4c1d95) !important;
          border: none !important;
        }
        button:hover {
          opacity: 0.9;
        }
        input:focus, textarea:focus {
          outline: 1px solid ${style.accent} !important;
        }
      `
    }
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data || {}

      if (d.type === "uc_set_global_style") {
        applyGlobalStyle(d.value)
      }

      if (d.type === "uc_console") {
        setOutput(prev => [...prev, d.value])
      }

      if (d.type === "uc_script_error") {
        setOutput(prev => [...prev, "Error: " + d.value])
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  function buildRuntime(userCode: string) {
    const escaped = String(userCode).replace(/<\/script>/g, "<\\/script>")

    return `
<!doctype html>
<html>
<body style="background:#000">
<script>
function print(){
  parent.postMessage({ type: "uc_console", value: Array.from(arguments).join(" ") }, "*")
}

function wait(ms){
  return new Promise(r => setTimeout(r, ms))
}

window.launcherAPI = {
  setGlobalStyle: function(obj){
    parent.postMessage({ type: "uc_set_global_style", value: obj }, "*")
  }
}

console.log = print

try{
  (async function(){
    ${escaped}
  })()
}catch(e){
  parent.postMessage({ type: "uc_script_error", value: String(e) }, "*")
}
</script>
</body>
</html>`
  }

  function runScript() {
    const code = useMonaco
      ? monacoInstanceRef.current?.getValue() ?? ""
      : textareaRef.current?.value ?? ""

    setOutput([])

    if (iframeRef.current) {
      iframeRef.current.srcdoc = buildRuntime(code)
    }
  }

  return (
    <div className="h-full w-full bg-[#0a0a12] text-white p-8 flex flex-col gap-8">

      <div>
        <h1 className="text-3xl font-bold tracking-wide">
          Script Studio
        </h1>
        <p className="text-sm text-purple-400 mt-1">
          Script Engine - You Own Your Direct App Now
        </p>
      </div>

      <div className="grid grid-cols-3 gap-8 flex-1">

        <div className="col-span-2 flex flex-col gap-6">

          <div className="h-[500px] rounded-2xl bg-[#111120] border border-purple-900 shadow-2xl overflow-hidden">
            <div ref={editorRef} style={{ width: "100%", height: "100%", display: useMonaco ? "block" : "none" }} />
            {!useMonaco && (
              <textarea
                ref={textareaRef}
                defaultValue={DEFAULT_CODE}
                className="w-full h-full bg-[#111120] text-purple-100 p-6 font-mono resize-none outline-none"
              />
            )}
          </div>

          <button
            onClick={runScript}
            className="px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4c1d95)"
            }}
          >
            Run Script
          </button>

        </div>

        <div className="flex flex-col rounded-2xl bg-[#111120] border border-purple-900 shadow-2xl p-6">

          <h2 className="text-lg font-semibold text-purple-300 mb-4">
            Output Console
          </h2>

          <div className="flex-1 bg-black/70 rounded-xl p-4 font-mono text-sm overflow-auto text-purple-200">
            {output.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

        </div>

      </div>

      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        title="runtime"
        style={{ width: 0, height: 0, border: 0 }}
      />

    </div>
  )
}