
export const LoginDescription = () => {
    return (
        <div className="w-full md:w-[60%] flex flex-col justify-center p-8 md:p-20 bg-gray-900 border-b md:border-b-0 md:border-r border-white/5 relative z-10 shrink-0">
            <div className="md:mx-25">
                <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight tracking-tight text-blue-100" style={{ fontFamily: "'Outfit', sans-serif" }}>AI Edit</h2>
                <p className="text-lg text-white/80 leading-relaxed max-w-[650px] mb-10">
                    A next-generation, browser-based video editing workspace. Seamlessly manage your projects locally, leverage WebGPU for high-performance processing, and experience a true privacy-first video editor without relying on cloud servers.
                </p>

                <ul className="flex flex-col gap-5 m-0 p-0 list-none">
                    <li className="flex items-center gap-4 text-[17px] text-zinc-200 font-medium">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✓</div>
                        <span>Local Project Management</span>
                    </li>
                    <li className="flex items-center gap-4 text-[17px] text-zinc-200 font-medium">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✓</div>
                        <span>WebGPU-Accelerated Processing</span>
                    </li>
                    <li className="flex items-center gap-4 text-[17px] text-zinc-200 font-medium">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">✓</div>
                        <span>Multi-Track Timeline Editing</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};
