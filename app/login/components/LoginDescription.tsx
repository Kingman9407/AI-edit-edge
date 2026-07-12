
export const LoginDescription = () => {
    return (
        <div className="w-full md:w-[60%] flex flex-col justify-center p-8 md:p-20 bg-gray-900 border-b md:border-b-0 md:border-r border-white/5 relative z-10 shrink-0">
            <div className="md:mx-25">
                <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight tracking-tight text-blue-100" style={{ fontFamily: "'Outfit', sans-serif" }}>AI Edit</h2>
                <p className="text-lg text-white/80 leading-relaxed max-w-[650px] mb-10">
                    The ultimate edge AI-powered video editing workspace. Experience seamless editing, smart scene detection, and instant rendering—all powered by state-of-the-art models running entirely in your browser. Say goodbye to upload times and hello to privacy-first, lightning-fast workflows.
                </p>

                <ul className="flex flex-col gap-5 m-0 p-0 list-none">
                    <li className="flex items-center gap-4 text-[17px] text-zinc-200 font-medium">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✓</div>
                        <span>Smart Video Editing</span>
                    </li>
                    <li className="flex items-center gap-4 text-[17px] text-zinc-200 font-medium">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✓</div>
                        <span>AI-Driven Scene Detection</span>
                    </li>
                    <li className="flex items-center gap-4 text-[17px] text-zinc-200 font-medium">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✓</div>
                        <span>Lightning Fast Rendering</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};
