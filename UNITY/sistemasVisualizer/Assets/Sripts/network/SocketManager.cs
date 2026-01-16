using System;
using System.Collections.Generic;
using SocketIOClient;
using UnityEngine;

public class SocketManager : MonoBehaviour
{
    public static SocketManager Instance { get; private set; }

    public SocketIOUnity socket;

    [Header("Server Settings")]
    [SerializeField] private string serverUrl = "http://localhost:3000";

    public event Action OnConnected;
    public event Action OnDisconnected;
    public event Action<List<RoomInfo>> OnRoomListUpdated;
    public event Action<GridSetup> OnGridSetup;
    public event Action<GridUpdate> OnGridUpdate;
    public event Action<List<ReplayInfo>> OnReplayListReceived;
    public event Action<ReplayData> OnReplayDataReceived;
    public event Action<string> OnGamePaused;
    public event Action OnGameResumed;
    public event Action<JoinedRoomData> OnJoinedRoom;

    #region Data Classes

    [Serializable]
    public class RoomInfo
    {
        public string roomId;
        public string roomName;
        public int playerCount;
        public int maxPlayers;
        public string status;
    }

    [Serializable]
    public class JoinedRoomData
    {
        public string roomId;
        public string roomName;
        public string status;
    }

    [Serializable]
    public class GamePausedData
    {
        public string reason;
    }

    [Serializable]
    public class GridSetup
    {
        public int playerId;
        public string playerName;
        public int sizeX;
        public int sizeY;
    }

    [Serializable]
    public class GridUpdate
    {
        public int playerId;
        public string playerName;
        public List<NodeUpdate> updatedNodes;
    }

    [Serializable]
    public class NodeUpdate
    {
        public int x;
        public int y;
        public int type;
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
        public int playerId;
        public GridUpdate gridUpdate;
    }

    [Serializable]
    public class ConnectedData
    {
        public string message;
        public string socketId;
    }

    [Serializable]
    public class ErrorData
    {
        public string message;
    }

    #endregion

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

    public async void Connect()
    {
        Debug.Log($"[SocketManager] Connect() called. url={serverUrl}");

        if (socket != null && socket.Connected)
        {
            Debug.Log("[SocketManager] Already connected!");
            return;
        }

        var uri = new Uri(serverUrl);
        socket = new SocketIOUnity(uri);

        socket.OnConnected += (sender, e) =>
        {
            Debug.Log("[SocketManager] Connected (OnConnected fired).");
            OnConnected?.Invoke();
        };

        socket.OnDisconnected += (sender, e) =>
        {
            Debug.Log("[SocketManager] Disconnected.");
            OnDisconnected?.Invoke();
        };

        socket.OnError += (sender, e) =>
        {
            Debug.LogError("[SocketManager] Socket Error: " + e);
        };

        RegisterEventListeners();

        try
        {
            Debug.Log("[SocketManager] Awaiting ConnectAsync()...");
            await socket.ConnectAsync();
            Debug.Log("[SocketManager] ConnectAsync() returned.");
        }
        catch (Exception ex)
        {
            Debug.LogError("[SocketManager] ConnectAsync failed: " + ex);
        }
    }

    private void RegisterEventListeners()
    {
        socket.On("connected", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<ConnectedData>(json);
                Debug.Log($"Server welcome: {data.message}, Socket ID: {data.socketId}");
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing connected: " + e.Message);
            }
        });

        socket.On("gamePaused", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<GamePausedData>(json);
                Debug.Log("Game Paused: " + data.reason);
                OnGamePaused?.Invoke(data.reason);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing gamePaused: " + e.Message);
            }
        });

        socket.On("gameResumed", response =>
        {
            Debug.Log("Game Resumed");
            OnGameResumed?.Invoke();
        });

        socket.On("roomList", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                Debug.Log("Received room list: " + json);

                var rooms = JsonUtility.FromJson<RoomListWrapper>("{\"rooms\":" + json + "}");
                Debug.Log("Parsed " + rooms.rooms.Count + " rooms");

                OnRoomListUpdated?.Invoke(rooms.rooms);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing room list: " + e.Message);
            }
        });

        socket.On("gridSetup", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                Debug.Log("Received grid setup: " + json);

                var gridSetup = JsonUtility.FromJson<GridSetup>(json);
                Debug.Log($"Grid setup for Player {gridSetup.playerId} ({gridSetup.playerName}): {gridSetup.sizeX}x{gridSetup.sizeY}");

                OnGridSetup?.Invoke(gridSetup);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing grid setup: " + e.Message);
            }
        });

        socket.On("gridUpdate", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                Debug.Log("Received grid update: " + json);

                var gridUpdate = JsonUtility.FromJson<GridUpdate>(json);
                Debug.Log($"Grid update for Player {gridUpdate.playerId} with {gridUpdate.updatedNodes.Count} nodes");

                OnGridUpdate?.Invoke(gridUpdate);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing grid update: " + e.Message);
            }
        });

        socket.On("joinedRoom", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                Debug.Log("Joined room: " + json);

                var data = JsonUtility.FromJson<JoinedRoomData>(json);
                OnJoinedRoom?.Invoke(data);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing joinedRoom: " + e.Message);
            }
        });

        socket.On("error", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<ErrorData>(json);
                Debug.LogError("Server error: " + data.message);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing error message: " + e.Message);
            }
        });

        socket.On("replayList", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var replays = JsonUtility.FromJson<ReplayListWrapper>("{\"replays\":" + json + "}");
                OnReplayListReceived?.Invoke(replays.replays);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing replay list: " + e.Message);
            }
        });

        socket.On("replayData", response =>
        {
            try
            {
                string json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var replayData = JsonUtility.FromJson<ReplayData>(json);
                OnReplayDataReceived?.Invoke(replayData);
            }
            catch (Exception e)
            {
                Debug.LogError("Error parsing replay data: " + e.Message);
            }
        });
    }

    public void RequestRoomList()
    {
        Debug.Log("Requesting room list...");
        socket?.Emit("getRoomList");
    }

    public void JoinRoom(string roomId)
    {
        Debug.Log("Joining room: " + roomId);
        socket?.Emit("joinRoomAsViewer", roomId);
    }

    public void LeaveRoom()
    {
        Debug.Log("Leaving room...");
        socket?.Emit("leaveRoom");
    }

    public void RequestReplayList()
    {
        socket?.Emit("getReplayList");
    }

    public void RequestReplayData(string replayId)
    {
        socket?.Emit("getReplay", replayId);
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