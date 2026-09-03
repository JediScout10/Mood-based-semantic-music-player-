```mermaid
flowchart TD
    subgraph Client["Browser"]
        A[Webcam Feed]
    end

    subgraph Flask["Flask Web App"]
        B["camera.py<br/>Video Streaming + Threading"]
        C["utils.py<br/>Frame Capture Helpers"]
    end

    subgraph Model["Emotion Detection"]
        D[OpenCV Face Detection]
        E["Model<br/>trained via train.py on data_moods.csv"]
        F[Predicted Emotion<br/>angry / happy / sad / neutral / etc.]
    end

    subgraph Spotify["Spotipy.py"]
        G["Hardcoded Mapping<br/>music_dist dict<br/>emotion index to playlist ID"]
        H[Spotify Web API<br/>via Spotipy]
    end

    subgraph UI["Frontend"]
        I[Neumorphism-styled HTML/CSS]
        J[Displayed Playlist]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> J
    B --> I
    I --> J

    style Client fill:#1a1a2e,stroke:#0f3460,color:#fff
    style Flask fill:#16213e,stroke:#0f3460,color:#fff
    style Model fill:#16213e,stroke:#0f3460,color:#fff
    style Spotify fill:#3d1a1a,stroke:#7a2e2e,color:#fff
    style UI fill:#1a1a2e,stroke:#0f3460,color:#fff
