using System.Collections. Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using UnityEngine.SceneManagement;

public class RoomListUI :  MonoBehaviour
{
    [Header("UI References")]
    [SerializeField] private GameObject roomItemPrefab;
    [SerializeField] private Transform roomListContainer;
    [SerializeField] private TextMeshProUGUI statusText;
    [SerializeField] private Button refreshButton;
    [SerializeField] private Button backButton;
    
    private void Start()
    {
        // Subscribe to socket events
        SocketManager.Instance.OnRoomListUpdated += OnRoomListUpdated;
        
        refreshButton.onClick. AddListener(RefreshRoomList);
        backButton.onClick. AddListener(GoBack);
        
        RefreshRoomList();
    }
    
    private void RefreshRoomList()
    {
        statusText.text = "Loading rooms... ";
        SocketManager.Instance.RequestRoomList();
    }
    
    private void OnRoomListUpdated(List<SocketManager.RoomInfo> rooms)
    {
        foreach (Transform child in roomListContainer)
        {
            Destroy(child.gameObject);
        }
        
        if (rooms.Count == 0)
        {
            statusText. text = "No rooms available";
            return;
        }
        
        statusText.text = $"{rooms.Count} room(s) found";
        
        foreach (var room in rooms)
        {
            GameObject roomItem = Instantiate(roomItemPrefab, roomListContainer);
            
            TextMeshProUGUI roomNameText = roomItem.transform.Find("RoomName").GetComponent<TextMeshProUGUI>();
            TextMeshProUGUI roomStatusText = roomItem.transform.Find("Status").GetComponent<TextMeshProUGUI>();
            Button joinButton = roomItem.transform.Find("JoinButton").GetComponent<Button>();
            
            roomNameText.text = room.roomName;
            roomStatusText.text = $"{room.playerCount}/{room.maxPlayers} - {room.status}";
            
            //Setup join button
            string roomId = room.roomId;
            joinButton.onClick.AddListener(() => JoinRoom(roomId));
            
            // Disable button if room is full or finished
            if (room.status == "finished" || room.status == "full")
            {
                joinButton.interactable = false;
            }
        }
    }
    
    private void JoinRoom(string roomId)
    {
        SocketManager.Instance.JoinRoom(roomId);
        SceneManager.LoadScene("GameViewer");
    }
    
    private void GoBack()
    {
        SceneManager.LoadScene("MainMenu");
    }
    
    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnRoomListUpdated -= OnRoomListUpdated;
        }
    }
}