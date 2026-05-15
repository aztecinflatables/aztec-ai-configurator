import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
    title: "AZTEC AI Configurator",
    description: "Configurator obiecte gonflabile – simulare AI"
};

export default function RootLayout({
    children
}: {
    children: ReactNode;
}) {
    return (
        <html lang="ro">
            <body>
                <div className="aztec-page">
                    <div className="aztec-empty-header" />
                    <main className="aztec-main">{children}</main>
                </div>
            </body>
        </html>
    );
}
