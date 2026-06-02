const tr = {
    settings: {
        enableInlineQueries: {
            name: "Satır içi sorguları etkinleştir",
            desc: "Normal satır içi Dataview sorgularının çalıştırılmasını etkinleştirir veya devre dışı bırakır.",
        },
        enableJsQueries: {
            name: "JavaScript sorgularını etkinleştir",
            desc: "DataviewJS sorgularının çalıştırılmasını etkinleştirir veya devre dışı bırakır.",
        },
        enableInlineJsQueries: {
            name: "Satır içi JavaScript sorgularını etkinleştir",
            desc: "Satır içi DataviewJS sorgularının çalıştırılmasını etkinleştirir veya devre dışı bırakır. DataviewJS sorgularının etkin olmasını gerektirir.",
        },
        enableInlineFieldHighlightingReadingView: {
            name: "Okuma görünümünde satır içi alan vurgulamayı etkinleştir",
            desc: "Okuma görünümünde satır içi alanlar için görsel vurgulamayı / güzel görünümü etkinleştirir veya devre dışı bırakır.",
        },
        enableInlineFieldHighlightingLivePreview: {
            name: "Canlı Önizlemede satır içi alan vurgulamayı etkinleştir",
            desc: "Canlı Önizlemede satır içi alanlar için görsel vurgulamayı / güzel görünümü etkinleştirir veya devre dışı bırakır.",
        },
        codeblocks: {
            heading: "Kod Blokları",
        },
        dataviewJsKeyword: {
            name: "DataviewJS anahtar kelimesi",
            desc: "DataviewJS blokları için anahtar kelime. Varsayılan: 'dataviewjs'. Değişikliklerin geçerli olması için yeniden yükleme gerekir.",
        },
        inlineQueryPrefix: {
            name: "Satır içi sorgu ön eki",
            desc: "Satır içi sorguların ön eki (Dataview sorgusu olarak işaretlemek için). Varsayılan: '='.",
        },
        inlineJsQueryPrefix: {
            name: "JavaScript satır içi sorgu ön eki",
            desc: "JavaScript satır içi sorgularının ön eki (DataviewJS sorgusu olarak işaretlemek için). Varsayılan: '$='.",
        },
        inlineQueriesInCodeblocks: {
            name: "Kod bloğu satır içi sorguları",
            desc: "Etkinleştirilirse, satır içi sorgular tam kod bloklarının içinde de değerlendirilir.",
        },
        view: {
            heading: "Görünüm",
        },
        showResultCount: {
            name: "Sonuç sayısını göster",
            desc: "Kapatılırsa, TASK ve TABLE sorgularının sonuç başlığındaki küçük sayı gizlenir.",
        },
        warnOnEmptyResult: {
            name: "Boş sonuçta uyar",
            desc: "Ayarlandığında, 0 sonuç döndüren sorgular bir uyarı mesajı gösterir.",
        },
        renderNullAs: {
            name: "Null değerini şu şekilde göster",
            desc: "Tablolarda varsayılan olarak null/var olmayan değerlerin nasıl görüneceği. Markdown gösterimini destekler.",
        },
        refreshEnabled: {
            name: "Otomatik görünüm yenileme",
            desc: "Etkinleştirilirse, kasanızdaki dosyalar değiştiğinde görünümler otomatik olarak yenilenir; bu, görünümlerdeki gömülü içerikler gibi bazı işlevleri olumsuz etkileyebilir, bu nedenle söz konusu işlevler çalışmıyorsa kapatın.",
        },
        refreshInterval: {
            name: "Yenileme aralığı",
            desc: "Görünümleri güncellemeden önce dosyaların değişmeyi bırakmasını bekleme süresi (milisaniye).",
        },
        defaultDateFormat: {
            name: "Tarih biçimi",
            desc: "Varsayılan tarih biçimi (Luxon tarih biçimi seçeneklerine bakın). Şu an: {0}",
        },
        defaultDateTimeFormat: {
            name: "Tarih + saat biçimi",
            desc: "Varsayılan tarih ve saat biçimi (Luxon tarih biçimi seçeneklerine bakın). Şu an: {0}",
        },
        tables: {
            heading: "Tablolar",
        },
        tableIdColumnName: {
            name: "Birincil sütun adı",
            desc: "Tablolardaki varsayılan kimlik sütununun adı; kaynak dosyaya bağlantı veren otomatik oluşturulan ilk sütundur.",
        },
        tableGroupColumnName: {
            name: "Gruplandırılmış sütun adı",
            desc: "Gruplandırılmış verilerde tablolardaki varsayılan kimlik sütununun adı; kaynak dosyaya/gruba bağlantı veren otomatik oluşturulan ilk sütundur.",
        },
        tasks: {
            heading: "Görevler",
        },
        taskCompletionTracking: {
            name: "Otomatik görev tamamlama takibi",
            desc1: "Etkinleştirilirse, Dataview görünümlerinde işaretlenen görevlere tamamlanma tarihi otomatik olarak eklenir.",
            desc2: "Varsayılan alan adı ve tarih biçimiyle örnek: - [x] görevim [completion:: 2022-01-01]",
        },
        taskCompletionUseEmojiShorthand: {
            name: "Tamamlama için emoji kısayolu kullan",
            desc1: 'Etkinleştirilirse, örtük "completion" görev alanını doldurmak için satır içi alan biçimi yerine emoji kısayolu kullanılır.',
            desc2: "Örnek: - [x] görevim ✅ 2022-01-01",
            desc3: "Tamamlama tarihi biçimini veya alan adını özelleştirmek ya da Dataview satır içi alan biçimlendirmesini kullanmak için bunu devre dışı bırakın.",
            desc4: '"Otomatik görev tamamlama takibi" etkinken kullanılabilir.',
            descDisabled: '"Otomatik görev tamamlama takibi" etkinken kullanılabilir.',
        },
        taskCompletionText: {
            name: "Tamamlama alanı adı",
            desc1: "Dataview görünümünde görev onay kutusu işaretlenirken tamamlanma tarihi için satır içi alan anahtarı olarak kullanılan metin.",
            desc2: '"Otomatik görev tamamlama takibi" etkin ve "tamamlama için emoji kısayolu kullan" devre dışıyken kullanılabilir.',
            descDisabled:
                '"Otomatik görev tamamlama takibi" etkin ve "tamamlama için emoji kısayolu kullan" devre dışıyken kullanılabilir.',
        },
        taskCompletionDateFormat: {
            name: "Tamamlama tarihi biçimi",
            desc1: "Dataview görünümünde görev onay kutusu işaretlenirken tamamlanma tarihi için tarih-saat biçimi (Luxon tarih biçimi seçeneklerine bakın).",
            desc2: '"Otomatik görev tamamlama takibi" etkin ve "tamamlama için emoji kısayolu kullan" devre dışıyken kullanılabilir.',
            desc3: "Şu an: {0}",
            descDisabled:
                '"Otomatik görev tamamlama takibi" etkin ve "tamamlama için emoji kısayolu kullan" devre dışıyken kullanılabilir.',
        },
        recursiveSubTaskCompletion: {
            name: "Özyinelemeli alt görev tamamlama",
            desc: "Etkinleştirilirse, Dataview'de bir görevi tamamlamak alt görevlerini de otomatik olarak tamamlar.",
        },
    },
    views: {
        loading: "Yükleniyor...",
        jsDisabled: "Dataview JS sorguları devre dışı. Dataview ayarlarından etkinleştirebilirsiniz.",
        inlineJsDisabled: "(devre dışı; ayarlardan etkinleştirin)",
        evaluationError: "Değerlendirme Hatası: {0}",
        noResultsList: "Dataview: Liste sorgusu için gösterilecek sonuç yok.",
        noResultsTable: "Dataview: Tablo sorgusu için gösterilecek sonuç yok.",
        noResultsTask: "Dataview: Görev sorgusu için gösterilecek sonuç yok.",
        noResultsCalendar: "Dataview: Sorgu 0 sonuç döndürdü.",
        inlineQueryError: "Dataview ('{0}' satır içi sorgusu için): {1}",
        inlineJsQueryError: "Dataview ('{0}' satır içi JS sorgusu için): {1}",
        unrecognizedValue: "Tanınmayan: {0}",
        calendarError: "Dataview: {0}",
    },
    query: {
        limitError: "'limit' ifadesi çalıştırılamadı: {0}",
        unrecognizedOperation: "Tanınmayan sorgu işlemi '{0}'",
    },
};

export default tr;
