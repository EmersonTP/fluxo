"use client";

import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((message: string) => {
    setMsg(message);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2400);
  }, []);

  const Toast = useCallback(
    () => (
      <div className={`fx-toast ${show ? "show" : ""}`}>
        <span className="tdot" />
        <span>{msg}</span>
      </div>
    ),
    [show, msg]
  );

  return { toast, Toast };
}
