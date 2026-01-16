using System;
using System.Collections.Generic;
using SocketIOClient;
using UnityEngine;

public class SocketManager : MonoBehaviour
{
    public static SocketManager Instance { get; private set; }

    public SocketIOUnity socket;

    [Header("Server Settings")]
    [SerializeField] private string serverUrl = "http://192.168.1.40:3000/";

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

    private object _mainThreadQueueLock = new object();
    private Queue<Action> _mainThreadQueue = new Queue<Action>();


    /*
     * Error parsing room list: get_childCount can only be called from the main thread.
Constructors and field initializers will be executed from the loading thread when loading a scene.
Don't use this function in the constructor or field initializers, instead move initialization code to the Awake or Start function.
UnityEngine.Debug:LogError (object)

    este error indica que hay actiones q tienen q ejecutarse en el hilo principal de Unity. lo solventamos así
     * */
    private void EnqueueOnMainThread(Action action)
    {
        if (action == null) return;

        //viva los mutex (aqui lockeamos la Queue x eso, así  nos aseguramos q el orden no se corrompe)
        lock (_mainThreadQueueLock)
        {
            _mainThreadQueue.Enqueue(action);
        }
    }

    private void Update()
    {
        while (true)
        {
            Action action;
            lock (_mainThreadQueueLock)
            {
                if (_mainThreadQueue.Count == 0)
                    return;

                action = _mainThreadQueue.Dequeue();
            }

            try
            {
                action?.Invoke();
            }
            catch (Exception ex)
            {
                Debug.LogError("[SocketManager] Main-thread action threw: " + ex);
            }
        }
    }

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
        EnqueueOnMainThread(() => Debug.Log($"[SocketManager] Connect() called. url={serverUrl}"));

        if (socket != null && socket.Connected)
        {
            EnqueueOnMainThread(() => Debug.Log("[SocketManager] Already connected!"));
            return;
        }

        var uri = new Uri(serverUrl);
        socket = new SocketIOUnity(uri);

        socket.OnConnected += (sender, e) =>
        {
            EnqueueOnMainThread(() =>
            {
                Debug.Log("[SocketManager] Connected (OnConnected fired).");
                OnConnected?.Invoke();
            });
        };

        socket.OnDisconnected += (sender, e) =>
        {
            EnqueueOnMainThread(() =>
            {
                Debug.Log("[SocketManager] Disconnected.");
                OnDisconnected?.Invoke();
            });
        };

        socket.OnError += (sender, e) =>
        {
            EnqueueOnMainThread(() => Debug.LogError("[SocketManager] Socket Error: " + e));
        };

        RegisterEventListeners();

        try
        {
            EnqueueOnMainThread(() => Debug.Log("[SocketManager] Awaiting ConnectAsync()..."));
            await socket.ConnectAsync();
            EnqueueOnMainThread(() => Debug.Log("[SocketManager] ConnectAsync() returned."));
        }
        catch (Exception ex)
        {
            EnqueueOnMainThread(() => Debug.LogError("[SocketManager] ConnectAsync failed: " + ex));
        }
    }

    private void RegisterEventListeners()
    {
        socket.On("connected", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<ConnectedData>(json);

                EnqueueOnMainThread(() =>
                {
                    Debug.Log($"Server welcome: {data.message}, Socket ID: {data.socketId}");
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing connected: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("gamePaused", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<GamePausedData>(json);

                EnqueueOnMainThread(() =>
                {
                    Debug.Log("Game Paused: " + data.reason);
                    OnGamePaused?.Invoke(data.reason);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing gamePaused: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("gameResumed", response =>
        {
            EnqueueOnMainThread(() =>
            {
                Debug.Log("Game Resumed");
                OnGameResumed?.Invoke();
            });
        });

        socket.On("roomList", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var rooms = JsonUtility.FromJson<RoomListWrapper>("{\"rooms\":" + json + "}");

                EnqueueOnMainThread(() =>
                {
                    Debug.Log("Received room list: " + json);
                    Debug.Log("Parsed " + (rooms.rooms != null ? rooms.rooms.Count : 0) + " rooms");
                    OnRoomListUpdated?.Invoke(rooms.rooms);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing room list: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("gridSetup", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var gridSetup = JsonUtility.FromJson<GridSetup>(json);

                EnqueueOnMainThread(() =>
                {
                    Debug.Log("Received grid setup: " + json);
                    Debug.Log($"Grid setup for Player {gridSetup.playerId} ({gridSetup.playerName}): {gridSetup.sizeX}x{gridSetup.sizeY}");
                    OnGridSetup?.Invoke(gridSetup);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing grid setup: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("gridUpdate", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var gridUpdate = JsonUtility.FromJson<GridUpdate>(json);

                EnqueueOnMainThread(() =>
                {
                    Debug.Log("Received grid update: " + json);
                    Debug.Log($"Grid update for Player {gridUpdate.playerId} with {(gridUpdate.updatedNodes != null ? gridUpdate.updatedNodes.Count : 0)} nodes");
                    OnGridUpdate?.Invoke(gridUpdate);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing grid update: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("joinedRoom", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<JoinedRoomData>(json);

                EnqueueOnMainThread(() =>
                {
                    Debug.Log("Joined room: " + json);
                    OnJoinedRoom?.Invoke(data);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing joinedRoom: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("error", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var data = JsonUtility.FromJson<ErrorData>(json);

                EnqueueOnMainThread(() => Debug.LogError("Server error: " + data.message));
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing error message: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("replayList", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var replays = JsonUtility.FromJson<ReplayListWrapper>("{\"replays\":" + json + "}");

                EnqueueOnMainThread(() =>
                {
                    OnReplayListReceived?.Invoke(replays.replays);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing replay list: " + msg + (json != null ? ("\n" + json) : "")));
            }
        });

        socket.On("replayData", response =>
        {
            string json = null;

            try
            {
                json = response.GetValue<System.Text.Json.JsonElement>().ToString();
                var replayData = JsonUtility.FromJson<ReplayData>(json);

                EnqueueOnMainThread(() =>
                {
                    OnReplayDataReceived?.Invoke(replayData);
                });
            }
            catch (Exception e)
            {
                var msg = e.Message;
                EnqueueOnMainThread(() => Debug.LogError("Error parsing replay data: " + msg + (json != null ? ("\n" + json) : "")));
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