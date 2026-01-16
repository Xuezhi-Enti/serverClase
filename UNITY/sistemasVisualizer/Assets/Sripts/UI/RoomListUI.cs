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
            Debug.LogError("SocketManager. Instance is NULL!");
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
                Debug.LogWarning("Socket not connected!  Trying to connect...");
                if (statusText != null)
                {
                    statusText.text = "Not connected!  Press refresh. ";
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
            Debug.Log("Creating UI for room: " + room.roomName + " (ID: " + room.roomId + ")");

            GameObject roomItem = Instantiate(roomItemPrefab, roomListContainer);

            // FIX: Use correct child names from ROOM. prefab:  "ROOMtext", "STatus", "JOIN"
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
                roomNameText.text = room.roomName;
            }

            if (roomStatusText != null)
            {
                roomStatusText.text = room.playerCount + "/" + room.maxPlayers + " - " + room.status;
            }

            if (joinButton != null)
            {
                string roomId = room.roomId;
                joinButton.onClick.AddListener(() => JoinRoom(roomId));

                if (room.status == "finished" || room.status == "full")
                {
                    joinButton.interactable = false;
                }
            }
        }

        Debug.Log("Room list UI updated");
    }

    private void JoinRoom(string roomId)
    {
        Debug.Log("Joining room: " + roomId);

        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.JoinRoom(roomId);
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