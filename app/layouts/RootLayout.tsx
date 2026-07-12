import type { Metadata } from "next";
import { FirebaseAuthProvider } from "@/app/context/FirebaseAuthContext";
import { ProjectFilesProvider } from "@/app/context/ProjectFilesContext";

export const metadata: Metadata = {
  title: "AI Edit",
  description: "Edge AI-powered video editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased font-sans`}
    >
      <head>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          * { box-sizing: border-box; }
          input::placeholder { color: rgba(255,255,255,0.25); }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <FirebaseAuthProvider>
          <ProjectFilesProvider>
            {children}
          </ProjectFilesProvider>
        </FirebaseAuthProvider>
      </body>
    </html>
  );
}
