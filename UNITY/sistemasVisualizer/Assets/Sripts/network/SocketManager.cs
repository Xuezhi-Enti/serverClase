using System;
using System.Collections. Generic;
using SocketIOClient;
using UnityEngine;

public class SocketManager : MonoBehaviour
{
    public static SocketManager Instance { get; private set; }
    
    public SocketIOUnity socket;
    
    [Header("Server Settings")]
    [SerializeField] private string serverUrl = "http://localhost:3000/";
    
    public event Action OnConnected;
    public event Action OnDisconnected;
    public event Action<List<RoomInfo>> OnRoomListUpdated;
    public event Action<NodeGrid.GridSetup> OnGridSetup;
    public event Action<NodeGrid. GridUpdate> OnGridUpdate;
    public event Action<List<ReplayInfo>> OnReplayListReceived;
    public event Action<ReplayData> OnReplayDataReceived;

    public event Action<string> OnGamePaused;
    public event Action OnGameResumed;
    
    [Serializable]
    public class RoomInfo
    {
        public string roomId;
        public string roomName;
        public int playerCount;
        public int maxPlayers;
        public string status; // "waiting", "playing", "finished"
    }
    
    [Serializable]
    public class GamePausedData
    {
        public string reason;
    }

    [Serializable]
    public class ReplayInfo
    {
        public string replayId;
        public string roomName;
        public string date;
        public string player1Name;
        public string player2Name;
    }
    
    [Serializable]
    public class ReplayData
    {
        public string replayId;
        public List<ReplayFrame> frames;
    }
    
    [Serializable]
    public class ReplayFrame
    {
        public float timestamp;
        public NodeGrid.GridUpdate gridUpdate;
    }
    
    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
            return;
        }
    }
    
    public void Connect()
    {
        if (socket != null && socket.Connected)
        {
            Debug.Log("Already connected!");
            return;
        }
        
        var uri = new Uri(serverUrl);
        socket = new SocketIOUnity(uri);
        
        //Connection events
        socket.OnConnected += (sender, e) =>
        {
            Debug.Log("Connected to server!");
            OnConnected?.Invoke();
        };
        
        socket.OnDisconnected += (sender, e) =>
        {
            Debug.Log("Disconnected from server!");
            OnDisconnected?.Invoke();
        };
        
        // Register event listeners
        RegisterEventListeners();
        
        socket.Connect();
    }
    
    private void RegisterEventListeners()
    {

    socket.On("gamePaused", response => 
    {
        var data = JsonUtility.FromJson<GamePausedData>(response. GetValue<string>());
        OnGamePaused?.Invoke(data.reason);
    });

    socket.On("gameResumed", response => 
    {
        OnGameResumed?.Invoke();
    });
        socket.On("roomList", response =>
        {
            try
            {
                string json = response.GetValue<string>();
                var rooms = JsonUtility.FromJson<RoomListWrapper>("{\"rooms\":" + json + "}");
                OnRoomListUpdated?.Invoke(rooms. rooms);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing room list: {e.Message}");
            }
        });
        
        //Grid setup
        socket.On("gridSetup", response =>
        {
            try
            {
                string json = response.GetValue<string>();
                var gridSetup = JsonUtility.FromJson<NodeGrid.GridSetup>(json);
                OnGridSetup?.Invoke(gridSetup);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing grid setup: {e.Message}");
            }
        });
        
        //Grid update
        socket.On("gridUpdate", response =>
        {
            try
            {
                string json = response. GetValue<string>();
                var gridUpdate = JsonUtility.FromJson<NodeGrid.GridUpdate>(json);
                OnGridUpdate?. Invoke(gridUpdate);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing grid update:  {e.Message}");
            }
        });
        
        socket.On("replayList", response =>
        {
            try
            {
                string json = response.GetValue<string>();
                var replays = JsonUtility.FromJson<ReplayListWrapper>("{\"replays\":" + json + "}");
                OnReplayListReceived?.Invoke(replays.replays);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing replay list: {e.Message}");
            }
        });
        
        socket.On("replayData", response =>
        {
            try
            {
                string json = response.GetValue<string>();
                var replayData = JsonUtility.FromJson<ReplayData>(json);
                OnReplayDataReceived?.Invoke(replayData);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing replay data: {e.Message}");
            }
        });
    }
    
    public void RequestRoomList()
    {
        socket?. Emit("getRoomList");
    }
    
    public void JoinRoom(string roomId)
    {
        socket?.Emit("joinRoomAsViewer", roomId);
    }
    
    public void LeaveRoom()
    {
        socket?. Emit("leaveRoom");
    }
    
    public void RequestReplayList()
    {
        socket?. Emit("getReplayList");
    }
    
    public void RequestReplayData(string replayId)
    {
        socket?. Emit("getReplay", replayId);
    }
    
    public void Disconnect()
    {
        if (socket != null && socket.Connected)
        {
            socket.Disconnect();
        }
    }
    
    private void OnApplicationQuit()
    {
        Disconnect();
    }
    
    [Serializable]
    private class RoomListWrapper
    {
        public List<RoomInfo> rooms;
    }
    
    [Serializable]
    private class ReplayListWrapper
    {
        public List<ReplayInfo> replays;
    }
}