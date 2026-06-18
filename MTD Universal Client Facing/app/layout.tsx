import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import StyledJsxRegistry from "./registry";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookkeeping & Document Capture Portal",
  description: "Secure record keeping, transaction confirmation, and Making Tax Digital preparations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>
        <StyledJsxRegistry>
          <AuthProvider>
            {children}
          </AuthProvider>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
