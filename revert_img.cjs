const fs = require('fs');
const file = '../spreadsheetfrontend/src/Components/GenerateInvoiceModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `const ProductImage = ({ imgSrc, prod, setPreviewProduct }) => {
    const [status, setStatus] = useState('loading');
    const [currentSrc, setCurrentSrc] = useState(imgSrc);

    // Sync state when prop changes
    useEffect(() => {
        setCurrentSrc(imgSrc);
        setStatus('loading');
    }, [imgSrc]);

    if (!currentSrc) {
        return <div className="w-14 h-14 rounded bg-gray-200 flex-shrink-0 flex items-center justify-center text-[8px] text-gray-400 border border-gray-300">No Img</div>;
    }

    return (
        <div className="relative w-14 h-14 flex-shrink-0 rounded bg-gray-100">
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center rounded border border-gray-200 z-10">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {status === 'error' ? (
                <div className="w-14 h-14 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-400 border border-gray-300">No Img</div>
            ) : (
                <img 
                    src={currentSrc} 
                    className={\`w-14 h-14 object-cover rounded bg-gray-100 hover:opacity-80 transition-opacity \${status === 'loading' ? 'opacity-0' : 'opacity-100'}\`} 
                    alt="img"
                    onLoad={() => setStatus('success')}
                    onError={() => { 
                        if (currentSrc && currentSrc.includes('localhost')) {
                            setCurrentSrc(currentSrc.replace(/http:\\/\\/localhost:\\d+/, 'https://apis.datsheets.in'));
                            setStatus('loading');
                        } else { 
                            setStatus('error');
                        }
                    }}
                    onClick={(e) => { e.stopPropagation(); setPreviewProduct({ ...prod, _resolvedImgSrc: currentSrc }); }}
                />
            )}
        </div>
    );
};`;

const replStr = `const ProductImage = ({ imgSrc, prod, setPreviewProduct }) => {
    const [status, setStatus] = useState('loading');

    if (!imgSrc) {
        return <div className="w-14 h-14 rounded bg-gray-200 flex-shrink-0 flex items-center justify-center text-[8px] text-gray-400 border border-gray-300">No Img</div>;
    }

    return (
        <div className="relative w-14 h-14 flex-shrink-0 rounded bg-gray-100">
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center rounded border border-gray-200 z-10">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {status === 'error' ? (
                <div className="w-14 h-14 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-400 border border-gray-300">No Img</div>
            ) : (
                <img 
                    src={imgSrc} 
                    key={imgSrc}
                    className={\`w-14 h-14 object-cover rounded bg-gray-100 hover:opacity-80 transition-opacity \${status === 'loading' ? 'opacity-0' : 'opacity-100'}\`} 
                    alt="img"
                    onLoad={() => setStatus('success')}
                    onError={(e) => { 
                        if (!e.target.dataset.retried && e.target.src.includes('localhost')) {
                            e.target.dataset.retried = 'true';
                            e.target.src = e.target.src.replace(/http:\\/\\/localhost:\\d+/, 'https://apis.datsheets.in');
                            setStatus('loading');
                        } else { 
                            setStatus('error');
                        }
                    }}
                    onClick={(e) => { e.stopPropagation(); setPreviewProduct({ ...prod, _resolvedImgSrc: e.target.src }); }}
                />
            )}
        </div>
    );
};`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replStr);
    fs.writeFileSync(file, content);
    console.log("Reverted ProductImage to original logic");
} else {
    console.log("Target not found");
}
