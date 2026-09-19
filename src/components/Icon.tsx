interface IconProps {
  name: "archive" | "arrow" | "check" | "chevronDown" | "chevronUp" | "file" | "folder" | "image" | "info" | "layers" | "lock" | "minus" | "pdf" | "plus" | "rotate" | "scissors" | "settings" | "shield" | "toolsFile" | "trash" | "unlock" | "x";
  size?: number;
}

const paths: Record<IconProps["name"], React.ReactNode> = {
  archive: <><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"/><path d="M2 10h20"/><path d="M10 10v10"/><path d="M14 10v10"/></>,
  arrow: <><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></>,
  check: <><path d="M5 13l4 4L19 7"/></>,
  chevronDown: <><path d="M6 9l6 6 6-6"/></>,
  chevronUp: <><path d="M6 15l6-6 6 6"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8h-6V4z"/><path d="M14 2v6h6"/></>,
  folder: <><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-4 4-3-3-4 4"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>,
  layers: <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  minus: <><path d="M5 12h14"/></>,
  pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8h-6V4z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  rotate: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></>,
  scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.59 8.59l11.42 6.42M8.59 15.41L20 9"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></>,
  shield: <path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z"/>,
  toolsFile: <><path d="M13 2H6a2 2 0 0 0-2 2v16h16V9l-7-7z"/><path d="M13 2v7h7"/><path d="m8 17 6.5-6.5"/><circle cx="7.5" cy="17.5" r="1.5"/><path d="m13.5 10.5 3-3M15 6l3 3"/></>,
  trash: <><path d="M5 7h14"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></>,
  x: <><path d="M18 6 6 18"/><path d="M6 6l12 12"/></>,
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="app-icon">
      {paths[name]}
    </svg>
  );
}
