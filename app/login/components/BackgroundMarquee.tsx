import Image from "next/image";

const ICONS = [
    "/login-icons/video-solid-full.svg",
    "/login-icons/scissors-solid-full.svg",
    "/login-icons/music-solid-full.svg",
    "/login-icons/film-solid-full.svg",
    "/login-icons/microphone-lines-solid-full.svg",
    "/login-icons/closed-captioning-solid-full.svg",
    "/login-icons/language-solid-full.svg",
    "/login-icons/pause-solid-full.svg"
];

export const BackgroundMarquee = () => {
    // We duplicate the array enough times so that sliding -50% creates a seamless loop
    const rowIcons = [...ICONS, ...ICONS, ...ICONS, ...ICONS, ...ICONS, ...ICONS];

    return (
        <div className="absolute w-[150vw] h-[150vh] -top-[25vh] -left-[25vw] -rotate-12 overflow-hidden pointer-events-none z-0 opacity-100 flex flex-col justify-around py-10">
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes marqueeLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        `
            }} />

            {[0, 1, 2, 3, 4, 5].map((rowIndex) => (
                <div
                    key={rowIndex}
                    className="flex whitespace-nowrap gap-24 items-center w-max"
                    style={{
                        animation: `${rowIndex % 2 === 0 ? 'marqueeLeft' : 'marqueeRight'} ${60 + rowIndex * 10}s linear infinite`
                    }}
                >
                    {rowIcons.map((src, i) => (
                        <Image
                            key={i}
                            src={src}
                            alt=""
                            width={80}
                            height={80}
                            className="w-20 h-20 shrink-0"
                            style={{
                                // Convert black to gray-900 (#111827) to match the right section background
                                filter: 'invert(7%) sepia(13%) saturate(1874%) hue-rotate(185deg) brightness(98%) contrast(92%)'
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};
