using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;

public class RoomListUI : MonoBehaviour
{
    [Header("UI References")]
    [SerializeField] private GameObject roomItemPrefab;
    [SerializeField] private Transform roomListContainer;
    [SerializeField] private TextMeshProUGUI statusText;
    [SerializeField] private Button refreshButton;
    [SerializeField] private Button backButton;

    private void Start()
    {
        Debug.Log("RoomListUI Started");

        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnRoomListUpdated += OnRoomListUpdated;
            Debug.Log("Subscribed to OnRoomListUpdated");
        }
        else
        {
            Debug.LogError("SocketManager.Instance is NULL!");
        }

        if (refreshButton != null)
        {
            refreshButton.onClick.AddListener(RefreshRoomList);
        }

        if (backButton != null)
        {
            backButton.onClick.AddListener(GoBack);
        }

        RefreshRoomList();
    }

    private void RefreshRoomList()
    {
        Debug.Log("RefreshRoomList called");

        if (statusText != null)
        {
            statusText.text = "Loading rooms...";
        }

        if (SocketManager.Instance != null && SocketManager.Instance.socket != null)
        {
            if (SocketManager.Instance.socket.Connected)
            {
                SocketManager.Instance.RequestRoomList();
                Debug.Log("Room list requested");
            }
            else
            {
                Debug.LogWarning("Socket not connected! Trying to connect...");
                SocketManager.Instance.Connect();

                if (statusText != null)
                {
                    statusText.text = "Connecting...";
                }
            }
        }
        else
        {
            Debug.LogError("SocketManager or socket is NULL!");
        }
    }

    private void OnRoomListUpdated(List<SocketManager.RoomInfo> rooms)
    {
        Debug.Log("OnRoomListUpdated called with " + rooms.Count + " rooms");

        foreach (Transform child in roomListContainer)
        {
            Destroy(child.gameObject);
        }

        if (rooms.Count == 0)
        {
            if (statusText != null)
            {
                statusText.text = "No rooms available";
            }
            Debug.Log("No rooms to display");
            return;
        }

        if (statusText != null)
        {
            statusText.text = rooms.Count + " room(s) found";
        }

        foreach (var room in rooms)
        {
            Debug.Log("Creating UI for room: " + room.name + " (ID: " + room.id + ")");

            GameObject roomItem = Instantiate(roomItemPrefab, roomListContainer);

            //un poco feo pero funciona
            TextMeshProUGUI roomNameText = roomItem.transform.Find("ROOMtext")?.GetComponent<TextMeshProUGUI>();
            TextMeshProUGUI roomStatusText = roomItem.transform.Find("STatus")?.GetComponent<TextMeshProUGUI>();
            Button joinButton = roomItem.transform.Find("JOIN")?.GetComponent<Button>();

            if (roomNameText == null)
            {
                Debug.LogError("Could not find 'ROOMtext' in room prefab!");
            }
            if (roomStatusText == null)
            {
                Debug.LogError("Could not find 'STatus' in room prefab!");
            }
            if (joinButton == null)
            {
                Debug.LogError("Could not find 'JOIN' in room prefab!");
            }

            if (roomNameText != null)
            {
                roomNameText.text = room.name;
            }

            if (roomStatusText != null)
            {
                roomStatusText.text = room.users + "/" + room.maxUsers + " - " + room.status;
            }

            if (joinButton != null)
            {
                string roomId = room.id;
                joinButton.onClick.AddListener(() => JoinRoomAsViewer(roomId));

                // Viewers can join any room except finished ones
                if (room.status == "finished")
                {
                    joinButton.interactable = false;
                }
            }
        }

        Debug.Log("Room list UI updated");
    }

    private void JoinRoomAsViewer(string roomId)
    {
        Debug.Log("Joining room as viewer: " + roomId);

        if (SocketManager.Instance != null)
        {
            // Join as viewer (viewers can join any room regardless of player count)
            SocketManager.Instance.JoinRoom(roomId);
            
            // Request the current grid state after joining
            SocketManager.Instance.RequestCurrentGridState();
            
            SceneManager.LoadScene("Gameplay");
        }
        else
        {
            Debug.LogError("Cannot join room - SocketManager is NULL!");
        }
    }

    private void GoBack()
    {
        Debug.Log("Going back to MainMenu");
        SceneManager.LoadScene("MainMenu");
    }

    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnRoomListUpdated -= OnRoomListUpdated;
            Debug.Log("Unsubscribed from OnRoomListUpdated");
        }
    }
}